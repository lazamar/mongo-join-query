const gulp = require("gulp");
const organiser = require("gulp-organiser");
const jasmine = require("gulp-jasmine");
const { SpecReporter } = require("jasmine-spec-reporter");

module.exports = organiser.register(task => {
    gulp.task(task.name, () => {
        return gulp.src(task.src).pipe(jasmine({
            reporter: new SpecReporter({
                spec: {
                    displayPending: true
                },
                summary: {
                    displayStacktrace: true
                }
            })
        }));
    });
});
