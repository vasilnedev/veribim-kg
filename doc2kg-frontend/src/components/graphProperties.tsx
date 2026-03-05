import { Box, Text, Heading, Code, VStack } from '@chakra-ui/react';
import { Divider } from '@chakra-ui/layout';
import { useQuery } from '@tanstack/react-query';

interface ApiNode {
  id: string;
  labels: string[];
  properties: { [key: string]: any };
}

export const GraphProperties = () => {
  const { data: selectedNode } = useQuery<ApiNode | null>({
    queryKey: ['selectedGraphNode'],
    staleTime: Infinity,
  });

  if (!selectedNode) {
    return (
      <Box w="600px" p={4} borderLeftWidth="1px" overflowY="auto">
        <Text>Select a node to see its properties.</Text>
      </Box>
    );
  }

  return (
    <Box w="600px" p={4} borderLeftWidth="1px" overflowY="auto">
      <VStack align="stretch" gap={4}>
        <Heading size="md">Node Properties</Heading>
        <Box>
          <Text fontWeight="bold">ID:</Text>
          <Code>{selectedNode.id}</Code>
        </Box>
        <Box>
          <Text fontWeight="bold">Labels:</Text>
          <Code>{selectedNode.labels.join(', ')}</Code>
        </Box>
        <Divider />
        <Heading size="sm">Other Properties</Heading>
        {Object.entries(selectedNode.properties).map(([key, value]) => (
          <Box key={key}>
            <Text fontWeight="bold">{key}:</Text>
            <Code whiteSpace="pre-wrap" wordBreak="break-word" w="full" display="block">
              {key === 'embedding' && Array.isArray(value)
                ? JSON.stringify(value.slice(0, 10), null, 2) + (value.length > 10 ? ' ...' : '')
                : typeof value === 'object'
                ? JSON.stringify(value, null, 2)
                : String(value)}
            </Code>
          </Box>
        ))}
      </VStack>
    </Box>
  );
};