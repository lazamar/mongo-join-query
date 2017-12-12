const mongoose = require("mongoose");
const Future = require("fluture");

const connect = () => {
    const isDisconnected = mongoose.connection.readyState === 0;
    if (isDisconnected) {
        mongoose.connect("mongodb://localhost/test");
    }

    return new Future((reject, resolve) => {
        mongoose.connection.once("open", () => resolve(mongoose.connection));
        mongoose.connection.once("error", reject);
    });
};

const disconnect = () =>
    Future((reject, resolve) => {
        mongoose.connection.close(resolve);
    });

const personSchema = mongoose.Schema({
    name: String,
    age: Number
});

const Person = mongoose.model("Person", personSchema);

connect()
    .map(() => console.log("Connected! Oh Yeah!"))
    .chain(disconnect)
    .fork(console.log, console.log);
