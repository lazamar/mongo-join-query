/* eslint-disable quote-props */
const organiser = require("gulp-organiser");

const noUnderscores = src =>
    [
        "!tests/**/_*/**/*.js", // no underscore folder
        "!tests/**/_*.js" // no underscore file
    ].concat(src);

organiser.registerAll("./tasks", {
    lint: {
        src: ["./tasks/**/*.js", "index.js", "./lib/**/*.js", "./tests/**/*.js"]
    },
    "jasmine-test-node": {
        unit: {
            src: noUnderscores("./tests/unit/**/*.js")
        },
        integration: {
            src: noUnderscores("./tests/integration/**/*.js")
        }
    }
});
