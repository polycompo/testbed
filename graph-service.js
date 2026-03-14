import {
  FLOW_HANDLE_SIDES,
  FLOW_NODE_DIMENSIONS,
  FLOW_NODE_HANDLE_COUNTS,
} from '../../domain/flow/flowConstants';

const SOURCE_DIRECTION = 'source';
const TARGET_DIRECTION = 'target';
const EMPTY_DISTANCE = Number.POSITIVE_INFINITY;
const HANDLE_INDEX_OFFSET = 1;
const HANDLE_ID_SEGMENT_LENGTH = 2;

/**
 * Creates a stable handle id for a side/index pair.
 * @param {string} side
 * @param {number} index
 * @returns {string}
 */
const createHandleId = (side, index) => `${side}-${index + HANDLE_INDEX_OFFSET}`;

/**
 * Converts a handle index into an even ratio on one node side.
 * @param {number} count
 * @param {number} index
 * @returns {number}
 */
const createHandleRatio = (count, index) => (index + HANDLE_INDEX_OFFSET) / (count + HANDLE_INDEX_OFFSET);

/**
 * Builds all handle descriptors for a node type from the configured max counts.
 * @param {string} nodeType
 * @returns {Record<string, Array<{id: string, ratio: number}>>}
 */
const createHandlesBySide = (nodeType) => {
  const handleCounts = FLOW_NODE_HANDLE_COUNTS[nodeType];

  return Object.keys(handleCounts).reduce((handlesBySide, side) => {
    const handleCount = handleCounts[side];

    return {
      ...handlesBySide,
      [side]: Array.from({ length: handleCount }, (_, index) => ({
        id: createHandleId(side, index),
        ratio: createHandleRatio(handleCount, index),
      })),
    };
  }, {});
};

/**
 * Adds a source/target direction prefix to a base handle id.
 * @param {string} direction
 * @param {string} handleId
 * @returns {string}
 */
const createDirectionalHandleId = (direction, handleId) => `${direction}-${handleId}`;

/**
 * Builds a unique port key for one node handle.
 * @param {string} nodeId
 * @param {string} handleId
 * @returns {string}
 */
const createPortKey = (nodeId, handleId) => `${nodeId}:${handleId}`;

/**
 * Normalizes optional reserved port keys into a Set.
 * @param {Iterable<string>|undefined} occupiedPortKeys
 * @returns {Set<string>}
 */
const normalizeOccupiedPortKeys = (occupiedPortKeys) => new Set(occupiedPortKeys || []);

/**
 * Removes a source/target prefix from a directional handle id.
 * @param {string} handleId
 * @returns {string}
 */
const removeDirectionPrefix = (handleId) => {
  if (typeof handleId !== 'string') {
    return '';
  }

  if (handleId.indexOf(`${SOURCE_DIRECTION}-`) === 0) {
    return handleId.slice(SOURCE_DIRECTION.length + 1);
  }

  if (handleId.indexOf(`${TARGET_DIRECTION}-`) === 0) {
    return handleId.slice(TARGET_DIRECTION.length + 1);
  }

  return handleId;
};

/**
 * Parses a directional or base handle id into side/index information.
 * @param {string} handleId
 * @returns {{side: string, index: number}|null}
 */
const parseBaseHandleId = (handleId) => {
  const normalizedHandleId = removeDirectionPrefix(handleId);
  const segments = normalizedHandleId.split('-');

  if (segments.length !== HANDLE_ID_SEGMENT_LENGTH) {
    return null;
  }

  const side = segments[0];
  const handleNumber = Number(segments[1]);

  if (!side) {
    return null;
  }

  if (Number.isNaN(handleNumber)) {
    return null;
  }

  return {
    side,
    index: handleNumber - HANDLE_INDEX_OFFSET,
  };
};

/**
 * Checks whether a handle id is still valid for the node's current type.
 * @param {{type: string}} node
 * @param {string} directionalHandleId
 * @returns {boolean}
 */
const isHandleAvailableOnNode = (node, directionalHandleId) => {
  const parsedHandleId = parseBaseHandleId(directionalHandleId);

  if (!parsedHandleId) {
    return false;
  }

  const handleCounts = FLOW_NODE_HANDLE_COUNTS[node.type];
  const sideHandleCount = handleCounts[parsedHandleId.side];

  if (typeof sideHandleCount !== 'number') {
    return false;
  }

  if (parsedHandleId.index < 0) {
    return false;
  }

  if (parsedHandleId.index >= sideHandleCount) {
    return false;
  }

  return true;
};

/**
 * Converts one logical handle into an absolute canvas point.
 * @param {{id: string, position: {x: number, y: number}, type: string}} node
 * @param {string} side
 * @param {{id: string, ratio: number}} handle
 * @param {string} direction
 * @returns {{handleId: string, portKey: string, x: number, y: number}}
 */
const createHandlePoint = (node, side, handle, direction) => {
  const size = FLOW_NODE_DIMENSIONS[node.type];
  const nodeX = node.position.x;
  const nodeY = node.position.y;
  const width = size.width;
  const height = size.height;

  if (side === FLOW_HANDLE_SIDES.LEFT) {
    return {
      handleId: createDirectionalHandleId(direction, handle.id),
      portKey: createPortKey(node.id, handle.id),
      x: nodeX,
      y: nodeY + height * handle.ratio,
    };
  }

  if (side === FLOW_HANDLE_SIDES.RIGHT) {
    return {
      handleId: createDirectionalHandleId(direction, handle.id),
      portKey: createPortKey(node.id, handle.id),
      x: nodeX + width,
      y: nodeY + height * handle.ratio,
    };
  }

  if (side === FLOW_HANDLE_SIDES.TOP) {
    return {
      handleId: createDirectionalHandleId(direction, handle.id),
      portKey: createPortKey(node.id, handle.id),
      x: nodeX + width * handle.ratio,
      y: nodeY,
    };
  }

  return {
    handleId: createDirectionalHandleId(direction, handle.id),
    portKey: createPortKey(node.id, handle.id),
    x: nodeX + width * handle.ratio,
    y: nodeY + height,
  };
};

/**
 * Collects all absolute handle points for one node and direction.
 * @param {{type: string}} node
 * @param {string} direction
 * @returns {Array<{handleId: string, portKey: string, x: number, y: number}>}
 */
const collectHandlePoints = (node, direction) => {
  const handles = createHandlesBySide(node.type);

  return Object.keys(handles).flatMap((side) =>
    handles[side].map((handle) => createHandlePoint(node, side, handle, direction))
  );
};

/**
 * Measures squared Euclidean distance between two handle points.
 * @param {{x: number, y: number}} sourcePoint
 * @param {{x: number, y: number}} targetPoint
 * @returns {number}
 */
const measureDistance = (sourcePoint, targetPoint) => {
  const deltaX = sourcePoint.x - targetPoint.x;
  const deltaY = sourcePoint.y - targetPoint.y;

  return deltaX * deltaX + deltaY * deltaY;
};

/**
 * Indexes nodes by id for fast lookup during routing.
 * @param {Array<{id: string}>} nodes
 * @returns {Map<string, any>}
 */
const buildNodeMap = (nodes) => new Map(nodes.map((node) => [node.id, node]));

/**
 * Builds every available source/target handle pair for one edge.
 * @param {object} sourceNode
 * @param {object} targetNode
 * @param {Iterable<string>|undefined} occupiedPortKeys
 * @returns {Array<{distance: number, sourceHandle: string, targetHandle: string, sourcePortKey: string, targetPortKey: string}>}
 */
const buildEdgeCandidates = (sourceNode, targetNode, occupiedPortKeys) => {
  const sourceHandlePoints = collectHandlePoints(sourceNode, SOURCE_DIRECTION);
  const targetHandlePoints = collectHandlePoints(targetNode, TARGET_DIRECTION);
  const occupiedPortKeySet = normalizeOccupiedPortKeys(occupiedPortKeys);

  return sourceHandlePoints
    .filter((sourceHandlePoint) => !occupiedPortKeySet.has(sourceHandlePoint.portKey))
    .flatMap((sourceHandlePoint) =>
      targetHandlePoints
        .filter((targetHandlePoint) => !occupiedPortKeySet.has(targetHandlePoint.portKey))
        .map((targetHandlePoint) => ({
          distance: measureDistance(sourceHandlePoint, targetHandlePoint),
          sourceHandle: sourceHandlePoint.handleId,
          targetHandle: targetHandlePoint.handleId,
          sourcePortKey: sourceHandlePoint.portKey,
          targetPortKey: targetHandlePoint.portKey,
        }))
    )
    .sort((leftCandidate, rightCandidate) => leftCandidate.distance - rightCandidate.distance);
};

/**
 * Extracts reserved port keys from already-fixed edges.
 * @param {Array<{source: string, target: string, sourceHandle?: string, targetHandle?: string}>} edges
 * @returns {Set<string>}
 */
const buildUsedPortKeysFromEdges = (edges) => {
  const usedPortKeys = new Set();

  edges.forEach((edge) => {
    const sourceBaseHandleId = removeDirectionPrefix(edge.sourceHandle);
    const targetBaseHandleId = removeDirectionPrefix(edge.targetHandle);

    if (sourceBaseHandleId) {
      usedPortKeys.add(createPortKey(edge.source, sourceBaseHandleId));
    }

    if (targetBaseHandleId) {
      usedPortKeys.add(createPortKey(edge.target, targetBaseHandleId));
    }
  });

  return usedPortKeys;
};

/**
 * Checks whether an edge still points to handles valid for current node types.
 * @param {{source: string, target: string, sourceHandle?: string, targetHandle?: string}} edge
 * @param {Map<string, any>} nodeMap
 * @returns {boolean}
 */
const isEdgeHandleSelectionAvailable = (edge, nodeMap) => {
  const sourceNode = nodeMap.get(edge.source);
  const targetNode = nodeMap.get(edge.target);

  if (!sourceNode || !targetNode) {
    return false;
  }

  if (!edge.sourceHandle || !edge.targetHandle) {
    return false;
  }

  if (!isHandleAvailableOnNode(sourceNode, edge.sourceHandle)) {
    return false;
  }

  if (!isHandleAvailableOnNode(targetNode, edge.targetHandle)) {
    return false;
  }

  return true;
};

/**
 * Finds nodes whose current edge handles became invalid after a type change.
 * @param {Array<object>} nodes
 * @param {Array<object>} edges
 * @returns {Set<string>}
 */
const collectUnavailableNodeIds = (nodes, edges) => {
  const nodeMap = buildNodeMap(nodes);

  return edges.reduce((unavailableNodeIds, edge) => {
    if (isEdgeHandleSelectionAvailable(edge, nodeMap)) {
      return unavailableNodeIds;
    }

    unavailableNodeIds.add(edge.source);
    unavailableNodeIds.add(edge.target);

    return unavailableNodeIds;
  }, new Set());
};

/**
 * Creates one edge descriptor with all routing candidates.
 * @param {{source: string, target: string}} edge
 * @param {number} index
 * @param {Map<string, any>} nodeMap
 * @param {Iterable<string>|undefined} occupiedPortKeys
 * @returns {{index: number, candidates: Array<object>}}
 */
const createEdgeDescriptor = (edge, index, nodeMap, occupiedPortKeys) => {
  const sourceNode = nodeMap.get(edge.source);
  const targetNode = nodeMap.get(edge.target);

  if (!sourceNode || !targetNode) {
    return {
      index,
      candidates: [],
    };
  }

  return {
    index,
    candidates: buildEdgeCandidates(sourceNode, targetNode, occupiedPortKeys),
  };
};

/**
 * Estimates a lower bound for the remaining assignment distance.
 * @param {Array<{candidates: Array<{distance: number}>}>} sortedDescriptors
 * @param {number} startIndex
 * @returns {number}
 */
const createOptimisticRemainingDistance = (sortedDescriptors, startIndex) =>
  sortedDescriptors.slice(startIndex).reduce((totalDistance, descriptor) => {
    const firstCandidate = descriptor.candidates[0];

    if (!firstCandidate) {
      return EMPTY_DISTANCE;
    }

    return totalDistance + firstCandidate.distance;
  }, 0);

/**
 * Rebuilds assignment results in the original edge order.
 * @param {Array<{index: number}>} sortedDescriptors
 * @param {Array<object>} assignmentsByIndex
 * @returns {Map<number, object>}
 */
const createAssignmentResult = (sortedDescriptors, assignmentsByIndex) => {
  const assignmentMap = new Map();

  sortedDescriptors.forEach((descriptor, descriptorIndex) => {
    assignmentMap.set(descriptor.index, assignmentsByIndex[descriptorIndex]);
  });

  return assignmentMap;
};

/**
 * Searches the global minimum assignment without reusing source/target ports.
 * @param {Array<{index: number, candidates: Array<object>}>} sortedDescriptors
 * @returns {Map<number, object>|null}
 */
const searchOptimalAssignments = (sortedDescriptors) => {
  const bestState = {
    distance: EMPTY_DISTANCE,
    assignments: null,
  };
  const tryAssign = (descriptorIndex, usedPortKeys, distance, assignmentsByIndex) => {
    if (descriptorIndex === sortedDescriptors.length) {
      if (distance >= bestState.distance) {
        return;
      }

      bestState.distance = distance;
      bestState.assignments = createAssignmentResult(sortedDescriptors, assignmentsByIndex);
      return;
    }

    const optimisticDistance = distance + createOptimisticRemainingDistance(sortedDescriptors, descriptorIndex);

    if (optimisticDistance >= bestState.distance) {
      return;
    }

    const descriptor = sortedDescriptors[descriptorIndex];

    descriptor.candidates.forEach((candidate) => {
      if (usedPortKeys.has(candidate.sourcePortKey)) {
        return;
      }

      if (usedPortKeys.has(candidate.targetPortKey)) {
        return;
      }

      const nextUsedPortKeys = new Set(usedPortKeys);
      const nextAssignmentsByIndex = assignmentsByIndex.slice();

      nextUsedPortKeys.add(candidate.sourcePortKey);
      nextUsedPortKeys.add(candidate.targetPortKey);
      nextAssignmentsByIndex[descriptorIndex] = candidate;

      tryAssign(
        descriptorIndex + 1,
        nextUsedPortKeys,
        distance + candidate.distance,
        nextAssignmentsByIndex
      );
    });
  };

  tryAssign(0, new Set(), 0, []);

  return bestState.assignments;
};

/**
 * Finds the best single edge handle match while respecting reserved ports.
 * @param {Array<object>} nodes
 * @param {string} sourceNodeId
 * @param {string} targetNodeId
 * @param {Iterable<string>|undefined} occupiedPortKeys
 * @returns {{sourceHandle: string, targetHandle: string, distance: number}|null}
 */
export const findSingleOptimalHandleMatch = (nodes, sourceNodeId, targetNodeId, occupiedPortKeys) => {
  const nodeMap = buildNodeMap(nodes);
  const sourceNode = nodeMap.get(sourceNodeId);
  const targetNode = nodeMap.get(targetNodeId);

  if (!sourceNode || !targetNode) {
    return null;
  }

  const candidates = buildEdgeCandidates(sourceNode, targetNode, occupiedPortKeys);
  const bestCandidate = candidates[0];

  if (!bestCandidate) {
    return null;
  }

  return {
    sourceHandle: bestCandidate.sourceHandle,
    targetHandle: bestCandidate.targetHandle,
    distance: bestCandidate.distance,
  };
};

/**
 * Finds the optimal non-overlapping handle assignments for a batch of edges.
 * @param {Array<object>} nodes
 * @param {Array<object>} edges
 * @param {Iterable<string>|undefined} occupiedPortKeys
 * @returns {Map<number, object>|null}
 */
const findAssignments = (nodes, edges, occupiedPortKeys) => {
  const nodeMap = buildNodeMap(nodes);
  const descriptors = edges.map((edge, index) => createEdgeDescriptor(edge, index, nodeMap, occupiedPortKeys));
  const hasEmptyCandidate = descriptors.some((descriptor) => !descriptor.candidates.length);

  if (hasEmptyCandidate) {
    return null;
  }

  const sortedDescriptors = descriptors
    .slice()
    .sort((leftDescriptor, rightDescriptor) => leftDescriptor.candidates.length - rightDescriptor.candidates.length);

  return searchOptimalAssignments(sortedDescriptors);
};

/**
 * Exposes the global optimal handle assignments for a full edge set.
 * @param {Array<object>} nodes
 * @param {Array<object>} edges
 * @returns {Map<number, object>|null}
 */
export const findMultiOptimalHandleMatches = (nodes, edges) =>
  findAssignments(nodes, edges);

/**
 * Applies resolved handle assignments back onto edge objects.
 * @param {Array<object>} edges
 * @param {Map<number, {sourceHandle: string, targetHandle: string}>|null} assignments
 * @returns {Array<object>}
 */
const applyAssignments = (edges, assignments) => {
  if (!assignments) {
    return edges;
  }

  return edges.map((edge, index) => {
    const assignment = assignments.get(index);

    if (!assignment) {
      return edge;
    }

    return {
      ...edge,
      sourceHandle: assignment.sourceHandle,
      targetHandle: assignment.targetHandle,
    };
  });
};

/**
 * Routes one new edge while avoiding ports already used by existing edges.
 * @param {Array<object>} nodes
 * @param {Array<object>} edges
 * @param {{source: string, target: string}} edge
 * @returns {object}
 */
export const rerouteSingleEdgeWithOptimalMatching = (nodes, edges, edge) => {
  const occupiedPortKeys = buildUsedPortKeysFromEdges(edges);
  const bestMatch = findSingleOptimalHandleMatch(nodes, edge.source, edge.target, occupiedPortKeys);

  if (!bestMatch) {
    return edge;
  }

  return {
    ...edge,
    sourceHandle: bestMatch.sourceHandle,
    targetHandle: bestMatch.targetHandle,
  };
};

/**
 * Reroutes only the edges connected to one node while preserving all other edge ports.
 * @param {Array<object>} nodes
 * @param {Array<object>} allEdges
 * @param {string} nodeId
 * @returns {Array<object>}
 */
export const rerouteEdgesForNode = (nodes, allEdges, nodeId) => {
  const stableEdges = allEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
  const incidentEdges = allEdges.filter((edge) => edge.source === nodeId || edge.target === nodeId);

  if (!incidentEdges.length) {
    return allEdges;
  }

  const occupiedPortKeys = buildUsedPortKeysFromEdges(stableEdges);
  const reroutedIncidentEdges = applyAssignments(incidentEdges, findAssignments(nodes, incidentEdges, occupiedPortKeys));
  const reroutedEdgeMap = new Map(reroutedIncidentEdges.map((edge) => [edge.id, edge]));

  return allEdges.map((edge) => {
    const reroutedEdge = reroutedEdgeMap.get(edge.id);

    if (!reroutedEdge) {
      return edge;
    }

    return reroutedEdge;
  });
};

/**
 * Reroutes all edges and automatically repairs nodes whose old handles became invalid.
 * @param {Array<object>} nodes
 * @param {Array<object>} edges
 * @returns {Array<object>}
 */
export const rerouteEdgesWithMultiOptimalMatching = (nodes, edges) => {
  const unavailableNodeIds = Array.from(collectUnavailableNodeIds(nodes, edges));

  if (!unavailableNodeIds.length) {
    return applyAssignments(edges, findMultiOptimalHandleMatches(nodes, edges));
  }

  const normalizedEdges = unavailableNodeIds.reduce(
    (currentEdges, nodeId) => rerouteEdgesForNode(nodes, currentEdges, nodeId),
    edges
  );

  return applyAssignments(normalizedEdges, findMultiOptimalHandleMatches(nodes, normalizedEdges));
};
