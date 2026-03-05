import { Flex } from '@chakra-ui/react';
import { GraphToolbar } from './graphToolbar';
import { GraphView } from './graphView';
import { GraphProperties } from './graphProperties';

export const GraphTab = () => {
  return (
    <Flex direction="column" h="100%" w="100%">
      <GraphToolbar />
      <Flex flex="1" overflow="hidden">
        <GraphView />
        <GraphProperties />
      </Flex>
    </Flex>
  );
};