/* eslint-disable quote-props */
const organiser = require("gulp-organiser");

organiser.registerAll("./tasks", {
    lint: {
        src: ["./tasks/**/*.js", "index.js", "./lib/**/*.js", "./tests/**/*.js"]
    },
    "jasmine-test-node": {
        src: "./tests/index.js"
    }
});
