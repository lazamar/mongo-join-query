# mongo-join-query

![Travis-CI](https://travis-ci.org/lazamar/mongo-join-query.svg?branch=master)

Allows you to query your database using linked collections in your query.

Imagine in your database you have Teams linked by ID to Players, which are linked by ID to Schools.

What if you want all teams with players that went to a school founded after 1950? Or if you wanted a
team object with all members embedded? What if their school were also embedded to them?

`mongo-join-query` allows you to do exactly that. You can populate as many levels deep as you want.

**Note**: You need to be using Mongoose to specify your database schema.

**Note**: Requires Mongo >= v3.4.

```javascript
mongoJoin(
    mongoose.models.Team,
    {
        find: { "members.studiedAt.yearFounded": { $gt: 1950 } },
        populate: ["members.studiedAt", "leader.studiedAt"],
        sort: { "members.age": 1 },
        skip: 10,
        limit: 1
    },
    (err, res) => (err ? console.log("Error:", err) : console.log("Success", res))
);
```

## How does it work?

Behind the scenes the options object is transformed in different stages in an
[aggregation pipeline](https://docs.mongodb.com/v3.4/aggregation/).

To see the entire aggregation pipeline being used add `debug: true` to the options object.

## Limits and Contributing

You can populate an array field if it is a property of the main Model of the query. But you cannot
populate an array field of linked models.

This is a shortcoming of the current implementation of the `$group` phase of the aggregation. If you
would like to contribute with this project, this is the place to look at.

When contributing please make sure to include a failing test int he pull request.

## Docs

The library exposes a single function which accepts three arguments:

```javascript
mongoJoin(
    mongoose.models.Team, // The mongoose model on which to do the query
    options, // an options object
    callback // A callback
);
```

### Options

```javascript
// The options object accepts the follwing fields:
const options =
    {
        // A query where you can treat all populated paths as
        // embedded documents
        find: { "members.studiedAt.yearFounded": { $gt: 1950 } },
        // A list of strings defining all the paths you would like to populate.
        // In this case we are populating the `members` field in Team and
        // inside the members field we are populating `studiedAt`.
        //
        // If you want to populate multiple paths in subdocuments, just
        // list the entire paths. For example, imagine you want to populate
        // `members` and inside each member you want to populate both `studiedAt`
        // and `bestFriend`. You would use an array like this:
        //  ["members.studiedAt", "members.bestFriend"]
        populate: ["members.studiedAt", "leader.studiedAt"],
        // What you would normally pass to .sort()
        sort: { "members.age": 1 },
        // How many documents to skip
        skip: 10,
        // Maximum number of documents to be returned
        limit: 1,
        // If debug is true, it will print the aggregation pipeline used in the query.
        debug: false
    },
```

### Callback

The callback takes two arguments:

* **error** - An error object. If there is no error it will be `null`. If there is an error, it will
  looks like this:

```javascript
    {   name: 'Invalid query',
        message: 'Invalid population path: Field nonExistent not found.',
        errors: []
    }
```

* **result** - If there is an error, the result will be null. If there isn't it will look like this:

```javascript
    {   name: 'Invalid query',
        message: 'Invalid population path: Field nonExistent not found.',
        errors: []
    }
```

## Full Example

Here is an example:

```javascript
const m = require("mongoose");
const mongoJoin = require("mongo-join-query");

const School = m.model(
    "School",
    m.Schema({
        name: String,
        yearFounded: Number
    })
);

const Player = m.model(
    "Player",
    m.Schema({
        name: String,
        age: Number,
        studiedAt: {
            type: m.Schema.Types.ObjectId,
            ref: "School"
        }
    })
);

const Team = m.model(
    "Team",
    m.Schema({
        name: String,
        leader: {
            type: m.Schema.Types.ObjectId,
            ref: "Player"
        },
        members: [
            {
                type: m.Schema.Types.ObjectId,
                ref: "Player"
            }
        ]
    })
);

m.connect("mongodb://localhost/test");
m.connection.once("open", () => {
    mongoJoin(
        m.models.Team,
        {
            find: { "members.studiedAt.yearFounded": { $gt: 1950 } },
            populate: ["members.studiedAt", "leader.studiedAt"],
            sort: { "members.age": 1 },
            skip: 10,
            limit: 1
        },
        callback
    );
});

function callback(error, res) {
    if (error) {
        console.log("An error occurred:", error);
        return;
    }

    console.log("Total of results found:", res.count);
    console.log("Values returned: ", JSON.stringify(res.results, null, 4));
    /*
    The result could look like this:

    Total of results found: 20
    Values returned:
        [
            {
                "_id": "5a304a75284c435f2d89d06a",
                "name": "team 3",
                "championships": 3,
                "leader": {
                    "_id": "5a304a75284c435f2d89d067",
                    "name": "Player 3",
                    "age": 27,
                    "studiedAt": {
                        "_id": "5a304a75284c435f2d89d064",
                        "name": "School 3",
                        "yearFounded": 1970,
                        "__v": 0
                    },
                    "__v": 0
                },
                "members": [
                    {
                        "_id": "5a304a75284c435f2d89d065",
                        "name": "Player 1",
                        "age": 25,
                        "studiedAt": {
                            "_id": "5a304a75284c435f2d89d062",
                            "name": "School 1",
                            "yearFounded": 1950,
                            "__v": 0
                        },
                        "__v": 0
                    },
                    {
                        "_id": "5a304a75284c435f2d89d066",
                        "name": "Player 2",
                        "age": 26,
                        "studiedAt": {
                            "_id": "5a304a75284c435f2d89d063",
                            "name": "School 2",
                            "yearFounded": 1960,
                            "__v": 0
                        },
                        "__v": 0
                    }
                ],
                "allMembers": [
                    "5a304a75284c435f2d89d065",
                    "5a304a75284c435f2d89d066",
                    "5a304a75284c435f2d89d067"
                ],
                "represents": "5a304a75284c435f2d89d064",
                "__v": 0,
                "_temp_leader0": {
                    "48772226526669904": "5a304a75284c435f2d89d067"
                },
                "_temp_studiedAt0": {
                    "16134390050729674": "5a304a75284c435f2d89d064"
                }
            }
        ]
     */
}
```
