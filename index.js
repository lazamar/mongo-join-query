const customFind = require("./lib/customFind");

/*
Options structure:
{
   find: {}, // search object
   sort, // sort object
   skip = 0, // int
   limit = 50, // int
   select,
   populate: [] // array of string ["contact.created_by", ...],
   debug: false
}
 */
module.exports = (Model, options, callback) =>
    customFind(Model, options).fork(err => callback(err), result => callback(null, result));
