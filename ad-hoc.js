const mongoose = require("mongoose");
const createTestData = require("./tests/integration/_createTestData");
const {
    connect, disconnect, aggregate, create
} = require("./lib/db");
// const customFind = require("./lib/customFind");
const log = require("./lib/logStuff");

const { Team } = mongoose.models;

const testTeam = {
    name: "testTeam",
    // leader: null,
    members: [],
    allMembers: [],
    // represents: null,
    championships: 10
};

connect("mongodb://localhost/test")
    .chain(createTestData)
    // .chain(() =>
    //     customFind(Team, {
    //         find: { championships: { $gt: 1 } },
    //         populate: ["leader.studiedAt"]
    //     }))
    .chain(() => create(Team, testTeam))
    .chain(() =>
        aggregate(Team, [
            {
                $lookup: {
                    from: "players",
                    localField: "leader",
                    foreignField: "_id",
                    as: "leader"
                }
            },
            {
                $unwind: {
                    path: "$leader",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: "schools",
                    localField: "leader.studiedAt",
                    foreignField: "_id",
                    as: "leader.studiedAt"
                }
            },
            {
                $unwind: {
                    path: "$leader.studiedAt",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $match: {
                    name: testTeam.name
                }
            },
            {
                $facet: {
                    count: [
                        {
                            $count: "total"
                        }
                    ],
                    results: [
                        {
                            $skip: 0
                        },
                        {
                            $limit: 50
                        }
                    ]
                }
            }
        ]))
    .map(log)
    .chain(disconnect)
    .fork(console.log, console.log);
