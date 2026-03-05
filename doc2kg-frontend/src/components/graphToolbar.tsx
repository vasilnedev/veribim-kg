import { Flex, Button } from '@chakra-ui/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Toaster, toaster } from "@/components/ui/toaster";

export const GraphToolbar = () => {
  const queryClient = useQueryClient();
  const { data: docId } = useQuery({ queryKey: ['docId'], staleTime: Infinity });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/doc2kg-backend/document/${docId}/graph`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importInDB: true, createEmbeddings: true }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['graph', docId] });
      toaster.create({
        title: "Graph generated",
        type: "success",
      });
    },
    onError: (error: any) => {
      toaster.create({
        title: "Graph generation failed",
        description: error.error || error.message || "Unknown error",
        type: "error",
      });
    },
  });

  return (
    <Flex w="full" p={4} borderBottomWidth="1px" alignItems="center" gap={4}>
      <Toaster />
      <Button onClick={() => generateMutation.mutate()} loading={generateMutation.isPending} disabled={!docId}>
        Generate
      </Button>
    </Flex>
  );
};