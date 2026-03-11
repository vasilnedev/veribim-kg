import { Flex, Button, Dialog, Progress, VStack, Text } from '@chakra-ui/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Toaster, toaster } from "@/components/ui/toaster";
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

interface ProgressData {
  docId: string;
  status: 'started' | 'processing' | 'importing' | 'completed' | 'failed';
  message: string;
  complete?: number;
  total?: number;
  percentage?: number;
  error?: string;
}

// Generate a unique ID for the socket connection for this session
const userId = Math.random().toString(36).substring(7);

export const GraphToolbar = () => {
  const queryClient = useQueryClient();
  const { data: docId } = useQuery({ queryKey: ['docId'], staleTime: Infinity });
  const [isGeneratingAsync, setIsGeneratingAsync] = useState(false);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);

  useEffect(() => {
    // Connect to the socket server, passing the unique userId
    const socket: Socket = io({
      path: '/doc2kg-backend/socket.io',
      query: { userId }
    });

    socket.on('connect', () => {
      console.log('Socket.IO connected with session user ID:', userId);
    });

    socket.on('graph-progress', (data) => {
      // Only show progress for the currently selected document
      if (data.docId !== docId) return;

      setProgressData(data);

      if (data.status === 'completed' || data.status === 'failed') {
        setIsGeneratingAsync(false);
        if (data.status === 'completed') {
          queryClient.invalidateQueries({ queryKey: ['graph', docId] });
        }
      }
    });

    // Disconnect on component unmount
    return () => {
      console.log('Socket.IO disconnecting...');
      socket.disconnect();
      setProgressData(null);
    };
  }, [docId, queryClient]);
  
  const asyncGenerateMutation = useMutation({
    mutationFn: async () => {
      setIsGeneratingAsync(true);
      const res = await fetch(`/doc2kg-backend/document/${docId}/graphgenerate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    },
    onSuccess: (data) => {
      toaster.create({
        title: "Back-end generation started",
        description: `Job ID: ${data.jobId}. You will be notified of the progress.`,
        type: "info",
      });
    },
    onError: (error: any) => {
      setIsGeneratingAsync(false);
      toaster.create({
        title: "Failed to start back-end generation",
        description: error.error || error.message || "Unknown error",
        type: "error",
      });
    },
  });

  return (
    <Flex w="full" p={4} borderBottomWidth="1px" alignItems="center" gap={4}>
      <Toaster />
      <Button onClick={() => asyncGenerateMutation.mutate()} loading={isGeneratingAsync} disabled={!docId}>
        Generate
      </Button>

      <Dialog.Root open={!!progressData} onOpenChange={(e) => { if (!e.open) setProgressData(null) }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Back-end Graph Generation</Dialog.Title>
              {(progressData?.status === 'completed' || progressData?.status === 'failed') && <Dialog.CloseTrigger />}
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={4} align="stretch">
                <Text>Status: <Text as="span" fontWeight="bold">{progressData?.status}</Text></Text>

                {(progressData?.status === 'processing' || progressData?.status === 'importing') && progressData.total && progressData.total > 0 ? (
                  <>
                    <Text>{progressData.message}</Text>
                    <Progress.Root value={progressData.percentage} width="100%" striped animated>
                      <Progress.Track bg="gray.200">
                        <Progress.Range bg="blue.500" />
                      </Progress.Track>
                    </Progress.Root>
                    <Text textAlign="center">{progressData.complete} / {progressData.total} ({progressData.percentage}%)</Text>
                  </>
                ) : (
                  <Text>{progressData?.message}</Text>
                )}

                {progressData?.status === 'failed' && (
                  <Text color="red.500" pt={4}>{progressData.error}</Text>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={() => setProgressData(null)} disabled={progressData?.status !== 'completed' && progressData?.status !== 'failed'}>
                Close
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Flex>
  );
};