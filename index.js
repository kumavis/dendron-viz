const ForceGraph = require('force-graph')
const { parse } = require('@babel/parser')
const { default: traverse } = require('@babel/traverse')
const CodeMirror = require('codemirror')
require('codemirror/mode/javascript/javascript.js')

const exampleCode = stringFromFn(() => {
  var x = 123
  var y = x
  var z = w(y)

  function w (abc) {
    return abc
  }
})

const codeMirror = CodeMirror(document.body, {
  value: exampleCode,
  mode: 'javascript',
})
const codeMirrorDoc = codeMirror.getDoc()

const graphData = generateGraphData({ codeString: exampleCode })
const myGraph = initGraph({
  container: document.getElementById('graph'),
})

myGraph
  .graphData(graphData)
  .onNodeHover((node) => {
    if (!node) return
    codeMirrorDoc.setSelections([
      rangeToAnchor(idToRange(node.id))
    ])
  })
  .onLinkHover((link) => {
    if (!link) return
    codeMirrorDoc.setSelections([
      rangeToAnchor(idToRange(link.source.id)),
      rangeToAnchor(idToRange(link.target.id)),
    ])
  })

function rangeToAnchor([start, end]) {
  return {
    anchor: codeMirrorDoc.posFromIndex(start),
    head: codeMirrorDoc.posFromIndex(end),
  }
}

codeMirror.on('change', () => {
  const codeString = codeMirrorDoc.getValue()
  myGraph.graphData(
    generateGraphData({ codeString })
  )
})

function generateGraphData ({ codeString }) {
  const refLinks = []
  const nodeSet = new Set()

  const ast = parse(codeString)

  // record path + contexts
  traverse(ast, {
    // enter (path) {
    //   nodeSet.add(path.node)
    //   if (!path.parent) return
    //   nodeSet.add(path.parent)
    //   refLinks.push({
    //     source: idForNode(path.parent),
    //     target: idForNode(path.node),
    //     name: `ast`,
    //   })
    // },
    ReferencedIdentifier: (path) => {
      const refTarget = path.scope.getBinding(path.node.name)
      nodeSet.add(path.node)
      if (!refTarget) return
      nodeSet.add(refTarget.path.node)
      refLinks.push({
        source: idForNode(path.node),
        target: idForNode(refTarget.path.node),
        name: `ref: "${path.node.name}"`,
        color: 'red',
      })
    },
    CallExpression: (path) => {
      const fnCallee = path.node.callee
      let calleeRefTargetNode
      // doing some shortening here (identifier -> fn definition)
      if (fnCallee.type === 'Identifier') {
        calleeRefTargetNode = path.scope.getBinding(fnCallee.name).path.node
      } else {
        calleeRefTargetNode = fnCallee
      }
      nodeSet.add(path.node)
      nodeSet.add(calleeRefTargetNode)
      refLinks.push({
        source: idForNode(path.node),
        target: idForNode(calleeRefTargetNode),
        name: `call callee: "${idForNode(path.node)}"`,
        color: 'purple',
      })
      path.node.arguments.forEach((argValue, index) => {
        const argDeclaration = calleeRefTargetNode.params[index]
        nodeSet.add(argValue)
        nodeSet.add(argDeclaration)
        refLinks.push({
          source: idForNode(argDeclaration),
          target: idForNode(argValue),
          name: `call args: "${argDeclaration.name}"`,
          color: 'orange',
        })
      })
      // TODO: check for member expression in callee and add as `this` ref
    },
    VariableDeclarator: (path) => {
      nodeSet.add(path.node)
      if (!path.node.init) return
      nodeSet.add(path.node.init)
      refLinks.push({
        source: idForNode(path.node),
        target: idForNode(path.node.init),
        name: `value assignment`,
        color: 'green',
      })
    },
    ReturnStatement: (path) => {
      const funcDeclaration = path.scope.block
      const argValue = path.node.argument
      nodeSet.add(funcDeclaration)
      nodeSet.add(argValue)
      refLinks.push({
        source: idForNode(funcDeclaration),
        target: idForNode(argValue),
        name: `return arg`,
        color: 'pink',
      })
    }
  })

  return {
    nodes: Array.from(nodeSet).map(nodeData => {
      return {
        id: idForNode(nodeData),
        name: idForNode(nodeData),
      }
    }),
    links: refLinks,
  }
}

function initGraph({ container }) {
  const myGraph = ForceGraph()
  myGraph(container)
    .linkDirectionalArrowLength(link => link.name === 'ast' ? 0 : 6)
  return myGraph
}

function stringFromFn(fn) {
  return `(${fn})()`
}

function parseFn (fn, opts) {
  const fnString = stringFromFn(fn)
  const ast = parse(fnString, opts)
  return ast
}


function idForNode (node) {
  return `${node.type}-${node.start}:${node.end}`
}

function idToRange (nodeId) {
  const rangeString = nodeId.slice(nodeId.indexOf('-') + 1)
  const [startString, endString] = rangeString.split(':')
  return [Number(startString), Number(endString)]
}
