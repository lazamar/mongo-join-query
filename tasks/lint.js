/* eslint-disable global-require, no-console */
const gulp = require("gulp");
const organiser = require("gulp-organiser");
const glob = require("glob");
const Future = require("fluture");
const { traverse } = require("ramda");
const shell = require("gulp-shell");

const getGlob = path =>
    Future((reject, resolve) => {
        glob(path, {}, (err, files) => (err ? reject(err) : resolve(files)));
    });

const runTask = (command, options) =>
    Future((reject, resolve) => {
        const task = shell.task(command, options);

        task(err => (err ? reject(err) : resolve()));
    });

const runEslint = files =>
    runTask(`node node_modules/eslint/bin/eslint.js --fix ${files.join(" ")}`, {
        errorMessage: "eslint failed with exit code <%= error.code %>"
    });

// For now we will not use prettier for linting
// const runPrettier = files =>
//     runTask(`node node_modules/prettier-eslint-cli/dist/index.js --write ${files.join(" ")}`, {
//         errorMessage: "prettier-eslint failed with exit code <%= error.code %>"
//     });

module.exports = organiser.register(task => {
    gulp.task(task.name, done => {
        traverse(Future.of, getGlob, task.src)
            // Flatten the array of arrays
            .map(f => f.reduce((acc, ff) => acc.concat(ff), []))
            .chain(runEslint)
            .fork(done, () => console.log("Success") || done());
    });
});
