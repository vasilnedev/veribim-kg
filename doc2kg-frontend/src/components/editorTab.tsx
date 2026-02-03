import { Flex, Box } from "@chakra-ui/react"
import EditorToolbar from "./editorToolbar"
import EditorPdf from "./editorPdf"
import EditorTxt from "./editorTxt"

export default function EditorTab() {
  return (
    <Flex direction="column" h="full">
      <EditorToolbar />
      <Flex flex="1" overflow="hidden">
        <Box flex="1" h="full">
          <EditorPdf />
        </Box>
        <Box flex="1" h="full">
          <EditorTxt />
        </Box>
      </Flex>
    </Flex>
  )
}