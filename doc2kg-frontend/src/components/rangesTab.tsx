import { Flex, Box } from "@chakra-ui/react"
import RangesToolbar from "./rangesToolbar"
import RangesView from "./rangesView"

export default function RangesTab() {
  return (
    <Flex direction="column" h="full">
      <RangesToolbar />
      <Flex flex="1" overflow="hidden">
        <Box flex="1" h="full">
          <RangesView />
        </Box>
      </Flex>
    </Flex>
  )
}