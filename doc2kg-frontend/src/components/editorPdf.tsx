import { Box, Text } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"

export default function EditorPdf() {
  const { data: docId } = useQuery({ queryKey: ['docId'], staleTime: Infinity })

  if (docId) {
    const pdfUrl = `/doc2kg-backend/document/${docId}/pdf`
    return (
      <Box w="full" h="full">
        <object
          key={pdfUrl}
          data={pdfUrl}
          type="application/pdf"
          width="100%"
          height="100%"
          style={{ border: 'none' }}
        />
      </Box>
    )
  }

  return (
    <Box w="full" h="full" p={4} borderRightWidth="1px">
      <Text>Use the Explorer to select a document.</Text>
    </Box>
  )
}