import { Box, Center, Spinner, Text } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"

export default function UsersGuideTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['usersGuide'],
    queryFn: () => fetch('UsersGuide.md').then( res => {
        if (!res.ok) throw new Error("Failed to load guide")
        return res.text()
    }),
    staleTime: Infinity,
  })

  if (isLoading) {
    return (
      <Center h="full">
        <Spinner />
      </Center>
    )
  }

  if (error) {
    return (
      <Center h="full">
        <Text color="red.500">Failed to load User's Guide.</Text>
      </Center>
    )
  }

  return (
    <Box h="full" w="full" p={4} overflowY="auto">
      <Box maxW="4xl" mx="auto" css={{
        "& h1": { fontSize: "2xl", fontWeight: "bold", mb: 4, borderBottom: "1px solid", borderColor: "gray.200", pb: 2 },
        "& h2": { fontSize: "xl", fontWeight: "bold", mt: 6, mb: 3, borderBottom: "1px solid", borderColor: "gray.200", pb: 1 },
        "& h3": { fontSize: "lg", fontWeight: "bold", mt: 4, mb: 2 },
        "& p": { mb: 4, lineHeight: "1.6" },
        "& ul": { paddingLeft: "1.5rem", mb: 4 },
        "& ol": { paddingLeft: "1.5rem", mb: 4 },
        "& li": { mb: 1 },
        "& blockquote": { borderLeft: "4px solid", borderColor: "gray.300", pl: 4, fontStyle: "italic", mb: 4 },
        "& code": { bg: "gray.800", p: 1, borderRadius: "sm", fontFamily: "monospace" },
        "& pre": { bg: "gray.800", p: 4, borderRadius: "md", overflowX: "auto", mb: 4 },
        "& pre code": { bg: "transparent", p: 0 },
        "& table": { width: "100%", borderCollapse: "collapse", mb: 4 },
        "& th, & td": { border: "1px solid", borderColor: "gray.300", p: 2 },
        "& th": { bg: "gray.800", fontWeight: "bold" },
        "& a": { color: "blue.500", textDecoration: "underline" },
        "& img": { maxWidth: "100%", height: "auto", my: 4 },
      }}>
        <ReactMarkdown>{data}</ReactMarkdown>
      </Box>
    </Box>
  )
}