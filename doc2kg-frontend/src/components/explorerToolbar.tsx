import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import {
  Flex,
  Button,
  Dialog,
  Field,
  Input,
  Stack,
} from "@chakra-ui/react"
import { useForm } from "react-hook-form"
import { Toaster, toaster } from "@/components/ui/toaster"

interface FormValues {
  url: string;
  pdf: FileList;
}

export default function ExplorerToolbar() {
  const [isAddOpen, setAddOpen] = useState(false)
  const onAddOpen = () => setAddOpen(true)
  const onAddClose = () => setAddOpen(false)

  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const { data: docId } = useQuery({ queryKey: ['docId'], staleTime: Infinity })
  const queryClient = useQueryClient()

  const {
    handleSubmit,
    register,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>()

  const pdfValue = watch("pdf")
  const urlValue = watch("url")

  const addMutation = useMutation({
    mutationFn: (formData: FormData) => {
      return fetch('/doc2kg-backend/document', {
        method: 'POST',
        body: formData,
      })
    },
    onSuccess: async (res) => {
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(errorText || 'Failed to add document')
      }
      console.log("Document added.")
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      toaster.create({
        title: "Document added",
        type: "success",
      })
      handleClose()
    },
    onError: (error: Error) => {
      console.error("An error occurred:", error.message)
      toaster.create({
        title: "Failed to add document",
        description: error.message,
        type: "error",
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!docId) throw new Error("No document selected for deletion.")
      return fetch(`/doc2kg-backend/document/${docId}`, {
        method: 'DELETE',
      })
    },
    onSuccess: async (res) => {
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to delete document' }))
        throw new Error(errorData.error || 'An unknown error occurred.')
      }
      toaster.create({
        title: "Document deleted",
        description: "The document and all its data have been removed.",
        type: "success",
      })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.setQueryData(['docId'], null)
      setDeleteConfirmOpen(false)
    },
    onError: (error: Error) => {
      toaster.create({
        title: "Deletion failed",
        description: error.message,
        type: "error",
      })
      setDeleteConfirmOpen(false)
    },
  })


  const onSubmit = (data: FormValues) => {
    const formData = new FormData()
    if (data.url) {
      formData.append('url', data.url)
    }
    if (data.pdf && data.pdf.length > 0) {
      formData.append('pdf', data.pdf[0])
    }
    addMutation.mutate(formData)
  }

  const handleClose = () => {
    reset()
    onAddClose()
  }

  return (
    <>
      <Toaster />
      <Flex w="full" p={4} borderBottomWidth="1px" gap={4} alignItems="center">
        <Button onClick={onAddOpen}>Add Document</Button>
        <Button colorPalette="red" onClick={() => setDeleteConfirmOpen(true)} disabled={!docId} ml="auto">
          Delete
        </Button>
      </Flex>

      <Dialog.Root open={isAddOpen} onOpenChange={(e) => !e.open && handleClose()}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Add a new document</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={4}>
                <Field.Root invalid={!!errors.url}>
                  <Field.Label htmlFor="url">Document URL</Field.Label>
                  <Input
                    id="url"
                    type="url"
                    {...register('url', {
                      validate: (value) => {
                        const pdfFiles = watch('pdf');
                        return (
                          !!value ||
                          (pdfFiles && pdfFiles.length > 0) ||
                          'Either a URL or a PDF file is required.'
                        );
                      },
                    })}
                  />
                  <Field.ErrorText>{errors.url?.message}</Field.ErrorText>
                </Field.Root>

                <Field.Root>
                  <Field.Label htmlFor="pdf">Or upload a PDF</Field.Label>
                  <Input
                    id="pdf"
                    type="file"
                    accept="application/pdf"
                    {...register('pdf')}
                    p={1.5}
                  />
                </Field.Root>
              </Stack>
            </Dialog.Body>

            <Dialog.Footer>
              <Button variant="ghost" mr={3} onClick={handleClose}>
                Cancel
              </Button>
              <Button
                colorPalette="green"
                type="submit"
                loading={isSubmitting || addMutation.isPending}
                disabled={!pdfValue?.length && !urlValue}
              >
                Submit
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </form>
        </Dialog.Positioner>
      </Dialog.Root>

      <Dialog.Root open={isDeleteConfirmOpen} onOpenChange={(e) => !e.open && setDeleteConfirmOpen(false)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Confirm Deletion</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              Are you sure you want to delete this document and all its associated data? This action cannot be undone.
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" mr={3} onClick={() => setDeleteConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                colorPalette="red"
                onClick={() => deleteMutation.mutate()}
                loading={deleteMutation.isPending}
              >
                Delete
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  )
}