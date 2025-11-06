import { useState, useEffect } from "react"
import { Provider } from "@/components/ui/provider"
import { AbsoluteCenter, Stack, Box, Image } from "@chakra-ui/react"

function App() {

  const [backendRes, setBackendRes] = useState<string | null>('Loading...')

  useEffect(() => {
    fetch("/doc2kg-backend/")
      .then(res => res.text())
      .then(setBackendRes)
      .catch(() => setBackendRes("Error connecting to backend"));
  }, [])

  return (
    <Provider>   
      <AbsoluteCenter>
        <Stack mt="6">
          <Image src="/doc2kg-frontend/favicon.svg" alt="Doc2kg Logo" boxSize="100px" mx="auto" />
          <Box bg="bg.emphasized" px="4" py="2" borderRadius="md" color="fg">
            <p><span style={{ color: 'green' }}>/doc2kg-frontend</span>, loaded with React and Chakra, is ready for development.</p>
          </Box>
          <Box bg="bg.emphasized" px="4" py="2" borderRadius="md" color="fg">
            <p><span style={{ color: 'green' }}>/doc2kg-backend</span> response is: {backendRes}</p>
          </Box>
        </Stack>
      </AbsoluteCenter>
    </Provider>
  )
}

export default App
