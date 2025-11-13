import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'

import { Provider } from "@/components/ui/provider"
import { AbsoluteCenter, Stack, Box, Image, Link, Heading } from "@chakra-ui/react"

const queryClient = new QueryClient()

function App() {
  const currentHost = window.location.hostname
  return (
    <QueryClientProvider client={queryClient}>
      <Provider>
        <AbsoluteCenter>
          <Stack mt="6">
            <Image src="/ifc2kg-frontend/favicon.svg" alt="Ifc2kg Logo" boxSize="100px" mx="auto" />
            <Heading as="h1" size="lg" textAlign="center" mb="4" color="red.500">
              IFC-to-Knowledge-Graph Stack
            </Heading>
            <Box bg="bg.panel" px="4" py="2" borderRadius="md" color="fg" textAlign="center">
              <Link href="/doc2kg-frontend/" color="green.500">Doc-to-KG Stack</Link>&nbsp;|&nbsp;
              <Link href="/rag-frontend/" color="blue.500">RAG Stack</Link>
            </Box>
            <Box bg="bg.emphasized" px="4" py="2" borderRadius="md" color="fg">
              <p><span style={{ color: 'red', fontWeight: 'bold' }}>/ifc2kg-frontend</span> is ready for development.</p>
            </Box>
            <Box bg="bg.emphasized" px="4" py="2" borderRadius="md" color="fg">
              <p><span style={{ color: 'red', fontWeight: 'bold' }}>/ifc2kg-backend</span> is responding: <BackendResponse /></p>
            </Box>
            <Box bg="bg.emphasized" px="4" py="2" borderRadius="md" color="fg" textAlign="center">
              <Heading as="h2" size="md" textAlign="center" mb="4">Data services:</Heading>
              <Link href={`http://${currentHost}:7474`} color="gray.500" target='_blank'>
                Neo4j (main)
              </Link>&nbsp;|&nbsp;
              <Link href={`http://${currentHost}:9001`} color="gray.500" target='_blank'>
                MinIO
              </Link>&nbsp;|&nbsp;
              <Link href={`http://${currentHost}:8081`} color="gray.500" target='_blank'>
                Mongo Express
              </Link>
            </Box>
          </Stack>
        </AbsoluteCenter>
      </Provider>
    </QueryClientProvider>
  )
}

function BackendResponse() {
  const { isPending, error, data } = useQuery({
    queryKey: ['backendResponse'],
    queryFn: () => fetch('/ifc2kg-backend/').then( res => res.text()),
  })

  if (isPending) return (<span>Loading...</span>)

  if (error) return (<span>An error has occurred: ${error.message}</span>)

  return (<span>{data}</span>)
}

export default App