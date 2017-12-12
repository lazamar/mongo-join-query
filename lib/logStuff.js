const { mapObjIndexed } = require("ramda");

const isRegex = v => v instanceof RegExp;
const isPrimitiveType = v =>
    typeof v === "boolean"
    || typeof v === "number"
    || typeof v === "undefined"
    || v === null
    || typeof v === "string"
    || v instanceof Date;

const parseQuery = q => (Array.isArray(q) ? q.map(parseValue) : mapObjIndexed(parseValue, q));

const isObjectID = v => !!v._bsontype;

const parseValue = v =>
    isRegex(v)
        ? `RegExp(${v.toString()})`
        : isPrimitiveType(v) ? v : isObjectID(v) ? `ObjectID ${v.toString()}` : parseQuery(v);

module.exports = v => console.log(JSON.stringify(parseQuery(v), null, 4));
