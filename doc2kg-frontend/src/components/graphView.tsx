import { useMemo } from 'react';
import { Box, Text, Center } from '@chakra-ui/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GraphCanvas, type InternalGraphNode } from 'reagraph';
import { LABELS, LABEL_COLORS } from './labels';

// Define types for API response
interface ApiNode {
  id: string;
  labels: string[];
  properties: { [key: string]: any };
}

interface ApiEdge {
  id: string;
  type: string;
  start: string;
  end: string;
  properties: { [key: string]: any };
}

interface GraphData {
  nodes: ApiNode[];
  edges: ApiEdge[];
}

export const GraphView = () => {
  const queryClient = useQueryClient();
  const { data: docId } = useQuery({ queryKey: ['docId'], staleTime: Infinity });

  const { data: graphData, isLoading, error } = useQuery<GraphData>({
    queryKey: ['graph', docId],
    queryFn: () =>
      fetch(`/doc2kg-backend/document/${docId}/graph`).then((res) => {
        if (!res.ok) throw new Error('Failed to fetch graph data');
        return res.json();
      }),
    enabled: !!docId,
  });

  const { nodes, edges } = useMemo(() => {
    if (!graphData) return { nodes: [], edges: [] };

    const transformedNodes = graphData.nodes.map((node) => {
      const nodeLabel = LABELS.find(label => node.labels.includes(label));
      return {
        id: node.id,
        label: node.properties.text?.slice(0, 20) || '',
        fill: nodeLabel ? LABEL_COLORS[nodeLabel] : '#718096',
      };
    });

    const transformedEdges = graphData.edges.map((edge) => ({
      id: edge.id,
      source: edge.start,
      target: edge.end,
      label: edge.type,
    }));

    return { nodes: transformedNodes, edges: transformedEdges };
  }, [graphData]);

  const handleNodeClick = (node: InternalGraphNode) => {
    const selectedApiNode = graphData?.nodes.find(n => n.id === node.id);
    if (selectedApiNode) {
      queryClient.setQueryData(['selectedGraphNode'], selectedApiNode);
    } else {
      queryClient.setQueryData(['selectedGraphNode'], null);
    }
  };

  if (!docId) {
    return <Center h="full" bg="gray.100"><Text>No document selected</Text></Center>;
  }

  if (isLoading) {
    return <Center h="full" bg="gray.100"><Text>Loading graph...</Text></Center>;
  }

  if (error) {
    return <Center h="full" bg="gray.100"><Text>An error has occurred: {error.message}</Text></Center>;
  }

  return (
    <Box w="full" h="full" position="relative" overflow="hidden">
      <GraphCanvas
        nodes={nodes}
        edges={edges}
        onNodeClick={handleNodeClick}
        labelType="all"
      />
    </Box>
  );
};
