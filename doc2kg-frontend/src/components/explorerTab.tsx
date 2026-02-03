import { Flex, Box } from "@chakra-ui/react"
import ExplorerToolbar from "./explorerToolbar"
import ExplorerList from "./explorerList"

export default function ExplorerTab() {
  return (
    <Flex direction="column" h="full">
      <ExplorerToolbar />
      <Flex flex="1" overflow="hidden">
        <Box flex="1" h="full">
          <ExplorerList />
        </Box>
      </Flex>
    </Flex>
  )
}