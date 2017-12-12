const { Either, Maybe } = require("ramda-fantasy");
const { traverse, mapObjIndexed } = require("ramda");
const mongoose = require("mongoose");
const trees = require("./tree");

/*
    This module has two main caveats:
        - To query a subfield you must populate it first. If you want to find
        all Projects where the creator has a certain email, you have to
        explicitly populate the "created_by" field.
        - It only populates fieds within arrays if they are part
        of the main Model being queried. For example
            - Populating "contacts.contact" from Project is fine, because contacts
            is a field directly from the main module, Project.
            - Populating "project.contacts.contact" from Deliverable is not going
            to work because contacts is a property on the second level, it is
            not directly a property of Deliverable.
*/

// A FieldModel can be a full Model, like db.models.Project, or a subModel
// of one, like db.models.Project.assignees

const Field = (name, isArray, model) => ({
    name,
    isArray: !!isArray,
    model
});

const flatten = arrayOfArrays => [].concat(...arrayOfArrays);

// =============================================================================
//                          PATH TO FIELD LIST
// =============================================================================

// Model => Maybe Model
const getPopulationModel = fieldModel =>
    Maybe.toMaybe(fieldModel)
        .chain(m => (m.options && m.options.ref ? Maybe.of(m.options.ref) : Maybe.Nothing()))
        .chain(ref => {
            try {
                return Maybe.of(mongoose.model(ref));
            } catch (e) {
                return Maybe.Nothing();
            }
        });

// Either String Field
const toField = (Model, field) => {
    const arrayModel = Model.schema.path(`${field}.0`);
    const nonArrayModel = Model.schema.path(field);

    let isArray;
    let localFieldModel;
    if (arrayModel) {
        isArray = true;
        localFieldModel = arrayModel;
    } else if (nonArrayModel) {
        isArray = false;
        localFieldModel = nonArrayModel;
    } else {
        return Either.Left(`Field ${field} not found.`);
    }

    const populationModel = getPopulationModel(localFieldModel);
    const fieldModel = populationModel.getOrElse(localFieldModel);

    return Either.of(Field(field, isArray, fieldModel));
};

// Model -> String -> Either String [Field]
const pathToFieldList = (Model, path) => {
    const parts = path.split(".");

    const eitherFieldList = parts.reduce(
        (eFieldList, fieldName) =>
            eFieldList.chain(fieldList => {
                const lastEl = fieldList[fieldList.length - 1];
                const model = lastEl ? lastEl.model : Model;
                return toField(model, fieldName).map(f => fieldList.concat(f));
            }),
        Either.of([])
    );

    return eitherFieldList;
};

// =============================================================================
//                          AGGREGATE PIPELINE GENERATOR
// =============================================================================
/*
    There are limitations to our automatic aggregation.
        - You can only have array fields in the first level, anything deeper
            than that will return an error.

    If the first item is an array, we add it's aggregation objects to the
    pipeline at the end, because all of the lookups will be in the middle.

    Dealing with arrays in aggregation requires two phases: unwinding and grouping
        - unwinding is done in the beginning
        - grouping is done after all other tasks except for length related tasks
 */
// =============================================================================

const isLookupField = field => !!field.model.modelName;

// Model -> [Field] -> Object
const groupingObject = (Model, arrayField) => {
    const keys = Object.keys(Model.schema.paths);
    return keys.reduce((acc, key) => {
        const operator = key === arrayField ? "$push" : "$first";
        const obj = Object.assign({}, acc, { [key]: { [operator]: `$${key}` } });
        obj._id = "$_id";
        return obj;
    }, {});
};

// Given a poppulation tree, checks if there is any deep array being
// populated. If there is, returns an error. If not, returns the root.
// Node -> Either String Node
const checkForDeepArray = root =>
    trees.reduce(
        (acc, node) =>
            acc.chain(() => {
                const field = trees.getContent(node);
                if (node === root) {
                    return Either.of(root);
                }

                if (!field.isArray) {
                    return Either.of(root);
                }

                const mPath = pathToRoot(root, node); // eslint-disable-line no-use-before-define
                const path = mPath.isJust ? mPath.value : field.name;

                return Either.Left(`Deep array at path "${path}". Population of deep array fields is not supported`);
            }),
        Either.of(root),
        root
    );

// Model -> Node -> Either String (Maybe Object)
const generateGrouping = (Model, root) =>
    checkForDeepArray(root)
        .map(trees.getContent)
        .map(field => {
            return !field.isArray
                ? Maybe.Nothing()
                : Maybe.of({
                    unwind: [
                        {
                            $unwind: {
                                path: `$${field.name}`,
                                preserveNullAndEmptyArrays: true
                            }
                        }
                    ],
                    group: [{ $group: groupingObject(Model, field.name) }]
                });
        });

// =============================================================================

const isSameField = (f1, f2) => f1.model === f2.model && f1.name === f2.name;

// [Field] -> Node
const fieldListToTree = fieldList =>
    fieldList.reduceRight((acc, v) => trees.Node(v, acc ? [acc] : []), null);

// [String] -> Either String [Node]
const createPopulationTrees = (Model, population) =>
    traverse(Either.of, path => pathToFieldList(Model, path), population).map(fieldLists =>
        fieldLists
            .map(fieldListToTree)
            .reduce((acc, tree) => trees.merge(isSameField, [...acc, tree]), []));

// Maybe String
const pathToRoot = (root, node) =>
    root === node
        ? Maybe.of(trees.getContent(node).name)
        : trees
            .getParent(root, node)
            .chain(parent => pathToRoot(root, parent))
            .map(parentPathToRoot => `${parentPathToRoot}.${trees.getContent(node).name}`);

// Node => [Object]
const treeToInstructions = root =>
    trees.reduce(
        (pipeline, node) => {
            const field = trees.getContent(node);
            if (!isLookupField(field)) {
                return pipeline;
            }

            // We can actually just get the maybe value here because
            // it should always find the path to root
            const fieldPath = pathToRoot(root, node).value;

            const tempField = `_temp_${field.name}${Math.random()}`;

            const lookup = [
                /*
                    What do these $addFields do?
                    When deeply populating an array field, we end up
                    with artefacts in the result. For example:
                     Populating "assignees.contact" would leave
                     records where assignees was an empty array
                     with this result: [{}]

                    To avoid that we create a "backup field", which
                    will hold information as to whether there was
                    something in our array field or not.
                    Then in the grouping phase we may replace
                    the ugly empty object {} with an `undefined` so
                    that after grouping we end up with [] rather than [{}]
                 */
                { $addFields: { [tempField]: `$${fieldPath}` } },
                {
                    $lookup: {
                        from: field.model.collection.name,
                        localField: fieldPath,
                        foreignField: "_id",
                        as: fieldPath
                    }
                },
                { $unwind: { path: `$${fieldPath}`, preserveNullAndEmptyArrays: true } }
            ];

            const replaceIfNull = [
                {
                    $addFields: {
                        [fieldPath]: {
                            $cond: {
                                if: { $not: `$${tempField}` },
                                then: `$${tempField}`,
                                else: `$${fieldPath}`
                            }
                        }
                    }
                }
            ];

            return [...pipeline, { lookup, replaceIfNull }];
        },
        [],
        root
    );

// Node => [Object]
const treeToLookup = root => {
    const instructions = treeToInstructions(root);

    const lookups = instructions.map(({ lookup }) => lookup);
    const replacements = [...instructions].reverse().map(({ replaceIfNull }) => replaceIfNull);
    return [...flatten(lookups), ...flatten(replacements)];
};

// This is the pipeline needed to populate one tree.
// A query can have multiple trees to populate and these
// can be safely used in sequence.
// Model -> Node -> Either String [Object]
const treeToPipeline = (Model, populationTree) =>
    generateGrouping(Model, populationTree).map(mGrouping => {
        // Maybe Object
        const lookup = treeToLookup(populationTree);
        if (!mGrouping.isJust) {
            return lookup;
        }
        const grouping = mGrouping.value;
        const res = [].concat(grouping.unwind, lookup, grouping.group);
        return res;
    });

// Model -> [String] -> Either String [Object]
const populationPipeline = (Model, populate) =>
    createPopulationTrees(Model, populate)
        .chain(populationTrees =>
            traverse(Either.of, v => treeToPipeline(Model, v), populationTrees))
        .bimap(err => `Invalid population path: ${err}`, v => v)
        .map(flatten);

// ========================== Parse query ======================================

// Mongo query don't freaking cast strings to ObjectIds so I have
// to check if there is any query on an objectID field and cast that
/* eslint-disable no-use-before-define, complexity */

const isObjectId = v => v && v.length && v.length === 24 && mongoose.Types.ObjectId.isValid(v);
const toObjectId = v => mongoose.Types.ObjectId(v);
const isPrimitiveType = v =>
    typeof v === "boolean"
    || typeof v === "number"
    || typeof v === "undefined"
    || v === null
    || v instanceof RegExp
    || typeof v === "string"
    || v instanceof Date
    || v instanceof mongoose.Types.ObjectId;

const parseValue = v => (isObjectId(v) ? toObjectId(v) : isPrimitiveType(v) ? v : parseQuery(v));

const parseQuery = q => (Array.isArray(q) ? q.map(parseValue) : mapObjIndexed(parseValue, q));

/* eslint-enable no-use-before-define, complexity */
// =============================================================================

// Build agggregation pipeline
// Model -> Object -> Either String Object
const build = (Model, options) => {
    const {
        find, // search object
        sort, // sort object
        skip = 0, // int
        limit = 50, // int
        // select,
        populate = [] // array of string ["contact.created_by", ...]
    } = options;

    return populationPipeline(Model, populate).map(pipeline => [
        ...pipeline,
        ...(find ? [{ $match: parseQuery(find) }] : []),
        ...(sort ? [{ $sort: sort }] : []),
        // Here we divide the result in two aggregation pipelines,
        // in one we count the items, in the other we split the results.
        {
            $facet: {
                count: [{ $count: "total" }],
                results: [{ $skip: skip }, { $limit: limit }]
            }
        }
    ]);
};

module.exports = {
    build,
    isPrimitiveType
};
