# mongo-join

Allows you to query your database using linked collections in your query.

Imagine in your database you have Teams with Players and each Player went to a different school.

Imagine you have a different model for each of these entities.

What if you want to search for teams based on the players' school? Or if you wanted a team object
with all members and the leader embedded? What if their school were also embedded to them?

This is what this extension allows you. Here is an example:

```javascript
const m = require("mongoose");
const mongoJoin = require("mongo-join");

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
