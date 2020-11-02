const ForceGraph = require('force-graph')
const { parse } = require('@babel/parser')
const { default: traverse } = require('@babel/traverse')
const CodeMirror = require('codemirror')
require('codemirror/mode/javascript/javascript.js')

const exampleCode = stringFromFn(() => {
  var x = 123
  var y = x + 1
  var z = w(y + 2)

  function w (abc) {
    return x + abc
  }
})

const codeMirror = CodeMirror(document.body, {
  value: exampleCode,
  mode: 'javascript'
})
const codeMirrorDoc = codeMirror.getDoc()

// const pathLookup = new WeakMap()

const myGraph = initGraph({
  container: document.getElementById('graph'),
  graphData: generateGraphData({ codeString: exampleCode }),
  onNodeHover: (node) => {
    if (!node) return
    const [start, end] = idToRange(node.id)    
    codeMirrorDoc.setSelection(
      codeMirrorDoc.posFromIndex(start),
      codeMirrorDoc.posFromIndex(end),
    )
  }
})

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
    enter (path) {
      nodeSet.add(path.node)
      if (!path.parent) return
      nodeSet.add(path.parent)
      refLinks.push({
        source: idForNode(path.parent),
        target: idForNode(path.node),
        name: `ast`,
        color: 'blue',
      })
    },
    ReferencedIdentifier: (path) => {
      const refTarget = path.scope.getBinding(path.node.name)
      nodeSet.add(path.node)
      if (!refTarget) return
      nodeSet.add(refTarget.identifier)
      refLinks.push({
        source: idForNode(path.node),
        target: idForNode(refTarget.identifier),
        name: `ref: "${idForNode(path.node)}"`,
        color: 'red',
      })
    },
    // CallExpression: (path) => {
    //   const fnCallee = path.node.callee
    //   // doing some shortening here (identifier -> refTarget)
    //   const calleeRefTargetNode = fnCallee.type === 'Identifier' ? path.scope.getBinding(fnCallee.name).identifier : fnCallee
    //   nodeSet.add(path.node)
    //   refLinks.push({
    //     source: idForNode(path.node),
    //     target: idForNode(calleeRefTargetNode),
    //     name: `call callee: "${idForNode(path.node)}"`,
    //     color: 'green',
    //   })
    //   nodeSet.add(calleeRefTargetNode)
    //   path.node.arguments.forEach(argNode => {
    //     refLinks.push({
    //       source: idForNode(path.node),
    //       target: idForNode(argNode),
    //       name: `call args: "${idForNode(argNode)}"`,
    //       color: 'yellow',
    //     })
    //     nodeSet.add(argNode)
    //   })
    // },
  })

  console.log(refLinks)

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

function initGraph({ container, graphData, onNodeHover }) {
  const myGraph = ForceGraph()
  myGraph(container)
    .graphData(graphData)
    .linkDirectionalArrowLength(6)
    .onNodeHover(onNodeHover)
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
