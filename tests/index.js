/* eslint-env jasmine */
const createTestData = require("./_createTestData");
const mongoose = require("mongoose");
const {
    connect, disconnect, find, create, remove
} = require("root-require")("./lib/db");
const customFind = require("root-require")("./lib/customFind");

describe("", () => {
    let connection;
    let teams;
    let players;
    let schools;
    const { Team, School, Player } = mongoose.models;

    beforeAll(done => {
        // Connect to test database and create test data
        connect("mongodb://localhost/test")
            .map(conn => {
                connection = conn;
                return connection;
            })
            .chain(createTestData)
            .map(created => {
                teams = created.teams;
                players = created.players;
                schools = created.schools;
                return null;
            })
            .fork(done, done);
    });

    it("connects successfully to database", () => {
        expect(connection).toBeTruthy();
        expect(typeof connection.close).toBe("function");
        expect(connection.readyState).toBe(1);
    });

    describe("vanilla find", () => {
        it("finds teams", done => {
            find(Team, { championships: { $gt: 1 } })
                .map(found => expect(found.length).toBe(2))
                .fork(done.fail, done);
        });

        it("finds players", done => {
            find(Player, { age: { $gt: 25 } })
                .map(found => expect(found.length).toBe(2))
                .fork(done.fail, done);
        });

        it("finds schools", done => {
            find(School, { yearFounded: { $gt: 1955 } })
                .map(found => expect(found.length).toBe(2))
                .fork(done.fail, done);
        });

        it("does not find document based on subdocuments properties", done => {
            find(Team, { "leader.age": { $gt: 25 } })
                .map(found => expect(found.length).toBe(0))
                .fork(done.fail, done);
        });
    });

    describe("mongo-join", () => {
        it("finds documents based on subDocuments properties", done => {
            customFind(Team, {
                find: { "leader.age": { $gt: 25 } }, // search object
                // sort, // sort object
                // skip = 0, // int
                // limit = 50, // int
                // // select,
                populate: ["leader"] // array of string ["contact.created_by", ...]
            })
                .map(found => expect(found.results.length).toBe(2))
                .fork(done.fail, done);
        });

        it("returns a count property with the total number of elements available before limiting and skipping", done => {
            let totalElements;

            customFind(School, {
                find: {}
            })
                .map(({ results, count }) => {
                    totalElements = count;
                    expect(results.length).toBe(count);
                    return count;
                })
                .chain(() =>
                    customFind(School, {
                        find: {},
                        skip: 1,
                        limit: 1
                    }))
                .map(({ results, count }) => {
                    expect(results.length).toBe(1);
                    expect(count).toBe(totalElements);
                    expect(count).not.toBe(undefined);
                    return count;
                })
                .fork(done.fail, done);
        });

        it("populates single fields", done => {
            customFind(Team, {
                populate: ["leader"]
            })
                .map(({ results }) => {
                    expect(results.length).toBe(3);
                    results.map(v => expect(v.leader.name).toBeTruthy());
                    return results;
                })
                .fork(done.fail, done);
        });

        it("populates one array field", done => {
            customFind(Team, {
                populate: ["members"]
            })
                .map(({ results }) => {
                    expect(results.length).toBe(3);

                    return results.map(v => {
                        expect(v.members.length).toBe(2);

                        return v.members.map(t => {
                            expect(t.name).toBeTruthy();
                            expect(t.age).toBeTruthy();
                            return t;
                        });
                    });
                })
                .fork(done.fail, done);
        });

        it("populates multiple array fields", done => {
            customFind(Team, {
                populate: ["members", "allMembers"]
            })
                .map(({ results }) => {
                    expect(results.length).toBe(3);
                    return results.map(v => {
                        expect(v.members.length).toBe(2);
                        expect(v.allMembers.length).toBe(3);

                        v.members.map(t => {
                            expect(t.age).toBeTruthy();
                            expect(t.name).toBeTruthy();
                            return t;
                        });

                        v.allMembers.map(t => {
                            expect(t.age).toBeTruthy();
                            expect(t.name).toBeTruthy();
                            return t;
                        });

                        return v;
                    });
                })
                .fork(done.fail, done);
        });

        it("deep populates single fields", done => {
            customFind(Team, {
                populate: ["leader.studiedAt"]
            })
                .map(({ results }) => {
                    expect(results.length).toBe(3);

                    return results.map(v => {
                        expect(v.leader.studiedAt.name).toBeTruthy(0);
                        return v;
                    });
                })
                .fork(done.fail, done);
        });

        it("deep populates multiple array fields", done => {
            customFind(Team, {
                populate: ["members.studiedAt", "allMembers.studiedAt"]
            })
                .map(({ results }) => {
                    expect(results.length).toBe(3);

                    return results.map(v => {
                        expect(v.members.length).toBe(2);
                        expect(v.allMembers.length).toBe(3);
                        v.members.map(t => expect(t.studiedAt.name).toBeTruthy());
                        return v.allMembers.map(t => expect(t.studiedAt.name).toBeTruthy());
                    });
                })
                .fork(done.fail, done);
        });

        it("queries first level", done => {
            customFind(Team, {
                find: { championships: 1 }
            })
                .map(({ results }) => {
                    expect(results.length).toBe(1);
                    expect(results[0].championships).toBe(1);
                    return results;
                })
                .fork(done.fail, done);
        });

        it("queries second level with population", done => {
            customFind(Team, {
                find: { "leader.age": 25 },
                populate: ["leader"]
            })
                .map(({ results }) => {
                    expect(results.length).toBe(1);
                    expect(results[0].leader.age).toBe(25);
                    return results;
                })
                .fork(done.fail, done);
        });

        it("queries third level from array field with population", done => {
            customFind(Team, {
                find: { "members.studiedAt.yearFounded": 1950 },
                populate: ["members.studiedAt"]
            })
                .map(({ results }) => {
                    expect(results.length).toBe(2);
                    expect(results[0].members[0].studiedAt.yearFounded).toBe(1950);
                    return results;
                })
                .fork(done.fail, done);
        });

        it("sorts output", done => {
            customFind(School, {
                sort: { yearFounded: 1 }
            })
                .map(({ results }) => {
                    expect(results.length).toBe(3);
                    expect(results[1].yearFounded).toBeGreaterThan(results[0].yearFounded);
                    return results;
                })
                .fork(done.fail, done);
        });

        it("reverse sorts output", done => {
            customFind(School, {
                sort: { yearFounded: -1 }
            })
                .map(({ results }) => {
                    expect(results.length).toBe(3);
                    expect(results[0].yearFounded).toBeGreaterThan(results[1].yearFounded);
                    return results;
                })
                .fork(done.fail, done);
        });
        it("skips a number of items", done => {
            customFind(Team, {
                skip: 1
            })
                .map(({ results }) => {
                    expect(results.length).toBe(2);
                    return results;
                })
                .fork(done.fail, done);
        });

        it("limits output", done => {
            customFind(Team, {
                limit: 1
            })
                .map(({ results }) => {
                    expect(results.length).toBe(1);
                    return results;
                })
                .fork(done.fail, done);
        });

        it("limits after skipping", done => {
            customFind(School, {
                skip: 1,
                limit: 1,
                sort: { yearFounded: 1 }
            })
                .map(({ results }) => {
                    expect(results.length).toBe(1);
                    expect(results[0].yearFounded).toBe(1960);
                    return results;
                })
                .fork(done.fail, done);
        });

        it("does not create artefacts in empty array fields when deep populating them", done => {
            const testTeam = {
                name: "testTeam",
                leader: players[1],
                members: [],
                allMembers: players,
                represents: schools[1],
                championships: 10
            };
            let created;

            create(Team, testTeam)
                .chain(t => {
                    created = t;
                    return customFind(Team, {
                        populate: ["members.studiedAt"],
                        find: { _id: created._id.toString() }
                    });
                })
                .map(({ results }) => {
                    expect(results.length).toBe(1);
                    expect(results[0].name).toBe(testTeam.name);
                    expect(results[0].members.length).toBe(0);
                    return results;
                })
                .chain(() => remove(created))
                .fork(done.fail, done);
        });

        it("does not create artefacts in empty single fields when deep populating them", done => {
            const testTeam = {
                name: "testTeam",
                leader: null,
                members: [],
                allMembers: players,
                represents: null,
                championships: 10
            };
            let created;

            create(Team, testTeam)
                .chain(t => {
                    created = t;
                    return customFind(Team, {
                        populate: ["leader.studiedAt", "represents"],
                        find: { _id: created._id.toString() }
                    });
                })
                .map(({ results }) => {
                    expect(results.length).toBe(1);
                    expect(results[0].leader).toBe(null);
                    expect(results[0].represents).toBe(null);
                    return results;
                })
                .chain(() => remove(created))
                .fork(done.fail, done);
        });

        it("allows searching for empty deeply populated arrays", done => {
            const testTeam = {
                name: "testTeam",
                leader: players[1],
                members: [],
                allMembers: players,
                represents: schools[1],
                championships: 10
            };

            let created;
            create(Team, testTeam)
                .chain(t => {
                    created = t;
                    return customFind(Team, {
                        populate: ["members.studiedAt"],
                        find: { members: [] }
                    });
                })
                .map(({ results }) => {
                    expect(results.length).toBe(1);
                    expect(results[0].name).toBe(testTeam.name);
                    expect(results[0].members.length).toBe(0);
                    return results;
                })
                .chain(() => remove(created))
                .fork(done.fail, done);
        });

        it("allows searching for empty deeply populated single fields", done => {
            const testTeam = {
                name: "testTeam",
                leader: null,
                members: [],
                allMembers: players,
                represents: schools[1],
                championships: 10
            };

            let created;
            create(Team, testTeam)
                .chain(t => {
                    created = t;
                    return customFind(Team, {
                        populate: ["leader.studiedAt"],
                        find: { leader: null }
                    });
                })
                .map(({ results }) => {
                    expect(results.length).toBe(1);
                    expect(results[0].name).toBe(testTeam.name);
                    expect(results[0].leader).toBe(null);
                    return results;
                })
                .chain(() => remove(created))
                .fork(done.fail, done);
        });

        it("accepts ObjectIds in queries", done => {
            let teamFound;
            find(Team, { championships: 1 })
                .chain(found => {
                    teamFound = found[0];
                    return customFind(Team, {
                        find: { _id: teamFound._id }
                    });
                })
                .map(({ results }) => {
                    expect(results.length).toBe(1);
                    expect(results[0].name).toBe(teamFound.name);
                    return results;
                })
                .fork(done.fail, done);
        });

        it("throws when trying to populate an invalid field", done => {
            customFind(Team, {
                find: {},
                populate: ["leader.nonExistent"]
            }).fork(err => {
                expect(err.name).toBe("Invalid query");
                expect(err.message).toContain("Invalid population path");
                done();
                return err;
            }, done.fail);
        });
    });

    it("disconnects successfully", done => {
        disconnect()
            .map(() => expect(connection.readyState).toBe(0))
            .fork(done.fail, done);
    });
});
