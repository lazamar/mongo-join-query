const mongoose = require("mongoose");
const Future = require("fluture");
const { traverse } = require("ramda");

const connect = url => {
    const isDisconnected = mongoose.connection.readyState === 0;
    if (isDisconnected) {
        mongoose.connect(url);
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

const save = doc =>
    Future((reject, resolve) => {
        doc.save((err, newDoc) => (err ? reject(err) : resolve(newDoc)));
    });

const create = (Model, content) => save(new Model(content));

const createAll = (Model, contentList) =>
    Future((reject, resolve) => {
        Model.create(contentList, (err, newDoc) => (err ? reject(err) : resolve(newDoc)));
    });

const find = (Model, query) =>
    Future((reject, resolve) => {
        Model.find(query, (err, results) => (err ? reject(err) : resolve(results)));
    });

const remove = doc =>
    Future((reject, resolve) => {
        doc.remove(err => (err ? reject(err) : resolve()));
    });

const removeAll = (Model, query) =>
    find(Model, query).chain(results => traverse(Future.of, res => remove(res), results));

const aggregate = (Model, pipeline) =>
    Future((reject, resolve) => {
        const cb = (err, results) => (err ? reject(err) : resolve(results));
        Model.aggregate(pipeline || []).exec(cb);
    });

module.exports = {
    connect,
    disconnect,
    create,
    createAll,
    find,
    remove,
    removeAll,
    aggregate,
    save
};
