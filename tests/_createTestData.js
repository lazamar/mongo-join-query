const mongoose = require("mongoose");
const { removeAll, createAll } = require("root-require")("./lib/db");
// ===================
//      MODELS
// ===================

const School = mongoose.model(
    "School",
    mongoose.Schema({
        name: String,
        yearFounded: Number
    })
);

const Player = mongoose.model(
    "Player",
    mongoose.Schema({
        name: String,
        age: Number,
        studiedAt: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "School",
            required: true
        }
    })
);

const Team = mongoose.model(
    "Team",
    mongoose.Schema({
        name: {
            type: String,
            required: true
        },
        championships: Number,
        leader: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Player"
        },
        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Player",
                required: true
            }
        ],
        allMembers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Player",
                required: true
            }
        ],
        represents: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "School"
        }
    })
);

// ===================
//      TEST DATA
// ===================

// Creates 3 Teams, 3 Players and 3 schools
module.exports = () => {
    const school1 = {
        name: "School 1",
        yearFounded: 1950
    };

    const school2 = {
        name: "School 2",
        yearFounded: 1960
    };

    const school3 = {
        name: "School 3",
        yearFounded: 1970
    };

    const player1 = {
        name: "Player 1",
        age: 25,
        studiedAt: null // to be added
    };

    const player2 = {
        name: "Player 2",
        age: 26,
        studiedAt: null // to be added
    };

    const player3 = {
        name: "Player 3",
        age: 27,
        studiedAt: null // to be added
    };

    let schools = [];
    let players = [];
    let teams = [];
    return removeAll(Team, {})
        .chain(() => removeAll(Player, {}))
        .chain(() => removeAll(School, {}))
        .chain(() => createAll(School, [school1, school2, school3]))
        .map(created => (schools = created))
        .chain(() => {
            player1.studiedAt = schools[0];
            player2.studiedAt = schools[1];
            player3.studiedAt = schools[2];

            return createAll(Player, [player1, player2, player3]);
        })
        .map(created => (players = created))
        .chain(() => {
            const team1 = {
                name: "team 1",
                leader: players[0],
                members: [players[1], players[2]],
                allMembers: players,
                represents: schools[0],
                championships: 1
            };

            const team2 = {
                name: "team 2",
                leader: players[1],
                members: [players[0], players[2]],
                allMembers: players,
                represents: schools[1],
                championships: 2
            };

            const team3 = {
                name: "team 3",
                leader: players[2],
                members: [players[0], players[1]],
                allMembers: players,
                represents: schools[2],
                championships: 3
            };

            return createAll(Team, [team1, team2, team3]);
        })
        .map(created => (teams = created))
        .map(() => ({ schools, teams, players }));
};
