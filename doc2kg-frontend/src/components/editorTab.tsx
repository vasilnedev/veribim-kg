import { Flex, Box } from "@chakra-ui/react"
import EditorToolbar from "./editorToolbar"
import EditorPdf from "./editorPdf"
import EditorTxt from "./editorTxt"
import { useQuery } from "@tanstack/react-query"

export default function EditorTab() {
  const { data: isPdfFolded } = useQuery({ queryKey: ['isPdfFolded'], staleTime: Infinity })

  return (
    <Flex direction="column" h="full">
      <EditorToolbar />
      <Flex flex="1" overflow="hidden">
        <Box
          w={isPdfFolded ? "0" : "50%"}
          opacity={isPdfFolded ? 0 : 1}
          transition="width 0.3s ease-in-out, opacity 0.3s ease-in-out"
          overflow="hidden"
          h="full"
          borderRightWidth={isPdfFolded ? "0" : "1px"}
        >
          <EditorPdf />
        </Box>
        <Box flex="1" h="full">
          <EditorTxt />
        </Box>
      </Flex>
    </Flex>
  )
}