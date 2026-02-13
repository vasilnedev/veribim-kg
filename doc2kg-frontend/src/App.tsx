import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'

import { Provider } from "@/components/ui/provider"
import { Box, Tabs } from "@chakra-ui/react"
import ExplorerTab from "./components/explorerTab"
import RangesTab from "./components/rangesTab"
import EditorTab from "./components/editorTab"

const queryClient = new QueryClient()
queryClient.setQueryData(['docId'], null)

function MainLayout() {
  const { data: docId } = useQuery({ queryKey: ['docId'], staleTime: Infinity })

  return (
    <Box h="100vh" w="100vw">
      <Tabs.Root defaultValue="explorer" h="full" display="flex" flexDirection="column">
        <Tabs.List>
          <Tabs.Trigger value="explorer">Explorer</Tabs.Trigger>
          <Tabs.Trigger value="ranges" disabled={!docId}>Ranges</Tabs.Trigger>
          <Tabs.Trigger value="editor" disabled={!docId}>Editor</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="explorer" flex="1" overflow="hidden" h="full" p={0}>
          <ExplorerTab />
        </Tabs.Content>
        <Tabs.Content value="ranges" flex="1" overflow="hidden" h="full" p={0}>
          <RangesTab />
        </Tabs.Content>
        <Tabs.Content value="editor" flex="1" overflow="hidden" h="full" p={0}>
          <EditorTab />
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider>
        <MainLayout />
      </Provider>
    </QueryClientProvider>
  )
}

export default App
