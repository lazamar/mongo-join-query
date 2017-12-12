/* eslint-disable no-irregular-whitespace */
const { Maybe } = require("ramda-fantasy");

// (a -> a -> Bool) -> [a] -> [[a]]
const groupBy = (isSame, list) =>
    list.reduce((acc, item) => {
        const existingGroupIndex = acc.findIndex(subList => isSame(subList[0], item));

        if (existingGroupIndex !== -1) {
            return acc.map(
                (subList, idx) => (idx === existingGroupIndex ? subList.concat([item]) : subList)
            );
        }

        return [...acc, [item]];
    }, []);

//= =============================================================================

// Object -> [Node] -> Node
const Node = (content, children) => ({
    content,
    // There cannot be repeated children
    children: [...new Set(children)]
});

const formatElement = (isLastElement, str) =>
    str
        .split("\n")
        .map(
            (line, lineNo) =>
                isLastElement
                    ? lineNo > 0 ? `    ${line}` : `└── ${line}`
                    : lineNo > 0 ? `│   ${line}` : `├── ${line}`
        )
        .join("\n");

// (content -> String) -> Node content -> String
const print = (contentToString, node) => {
    const nodeString = contentToString(node.content);

    const lastIndex = node.children.length - 1;
    const formattedChildren = node.children
        .map(c => print(contentToString, c))
        .map((c, index) => formatElement(index === lastIndex, c));

    return [nodeString, ...formattedChildren].join("\n");
};

// Node a -> [a]
const getChildren = node => node.children;

// Node a -> a
const getContent = node => node.content;

const compareNodes = (comparison, node1, node2) => comparison(getContent(node1), getContent(node2));

const areEqual = (isSame, tree1, tree2) => {
    const differentChildCount = !tree1.children.length === tree2.children.length;
    if (!compareNodes(isSame, tree1, tree2) || differentChildCount) {
        return false;
    }

    return tree1.children.reduce((acc, child) => {
        const counterpart = tree2.children.find(c => compareNodes(isSame, child, c));
        return !counterpart ? false : areEqual(isSame, child, counterpart);
    }, true);
};

// (Node -> Node -> Bool) -> Node -> Node -> [Node]
const merge = (isSame, trees) => {
    // These are groups where the isSame function returned
    // true for all of them.
    // These groups have at least one element.
    const treeGroups = groupBy((n1, n2) => compareNodes(isSame, n1, n2), trees);
    return (
        treeGroups
            .map(group => {
                // Array of children
                const children = group.map(getChildren).reduce((acc, l) => [...acc, ...l], []);
                const content = getContent(group[0]);
                return Node(content, merge(isSame, children));
            })
            // flatten
            .reduce((acc, l) => [...acc, l], [])
    );
};

// Node -> Node -> Maybe Node
const getParent = (root, node) =>
    root.children.reduce((found, childNode) => {
        if (found.isJust) {
            return found;
        }

        return childNode === node ? Maybe.Just(root) : getParent(childNode, node);
    }, Maybe.Nothing());

// (b -> a -> b) -> b -> Node a
const reduce = (f, startVal, root) => {
    const reducedRoot = f(startVal, root);
    return root.children.reduce((acc, childNode) => reduce(f, acc, childNode), reducedRoot);
};

const demoTree = (function () {
    const a = Node("a", []);
    const b = Node("b", [a]);
    const c = Node("c", []);
    const d = Node("d", [c, b]);
    const e = Node("e", []);
    const r = Node("r", [e, d]);
    return r;
}());

module.exports = {
    Node,
    getParent,
    getContent,
    print,
    merge,
    groupBy,
    areEqual,
    reduce,
    demoTree
};
