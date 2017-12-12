const Future = require("fluture");
const pipelineBuilder = require("./pipelineBuilder");
const { aggregate } = require("./db");
const log = require("./logStuff");

const noKeys = v => Object.keys(v).length === 0;
const isEmpty = v => !pipelineBuilder.isPrimitiveType(v) && noKeys(v) && !Array.isArray(v);
const maxDepth = 2;

const removeEmptyObjects = (doc, depth = 0) =>
    depth > maxDepth || pipelineBuilder.isPrimitiveType(doc)
        ? doc
        : Object.keys(doc)
            .map(key => {
                const val = doc[key];

                return {
                    key,
                    value: Array.isArray(val)
                        ? val
                            .filter(vv => !isEmpty(vv) && vv !== null)
                            .map(vv => removeEmptyObjects(vv, depth + 1))
                        : removeEmptyObjects(val, depth + 1)
                };
            })
            .filter(({ value }) => !isEmpty(value))
            .reduce((acc, { key, value }) => {
                acc[key] = value;
                return acc;
            }, {});

const asMongooseError = err => ({
    name: "Invalid query",
    message: err,
    errors: []
});

/*
Options structure:
{
   find: {}, // search object
   sort, // sort object
   skip = 0, // int
   limit = 50, // int
   select,
   populate: [] // array of string ["contact.created_by", ...]
}
 */

const customFind = (Model, options) =>
    pipelineBuilder.build(Model, options).either(
        err => Future.reject(asMongooseError(err)),
        pipe =>
            aggregate(Model, pipe)
                // the aggregation result is an array
                .map(arr => arr[0])
                .map(output => ({
                    // When doing population in the aggregation pipeline,
                    // if a field is deeply populated for two levels or
                    // more, documents where this field was empty
                    // will have an empty object in them.
                    // This happens because of the lookup phase of aggregation.
                    // The mapping of removeEmptyObjects
                    // after the aggregation removes that.
                    results: output.results.map(v => removeEmptyObjects(v)),
                    // results: output.results,
                    count: output.count[0] ? output.count[0].total : 0
                }))
    );

module.exports = customFind;
