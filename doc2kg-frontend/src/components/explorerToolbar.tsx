import { useMutation, useQueryClient } from "@tanstack/react-query"
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
  const [isOpen, setIsOpen] = useState(false)
  const onOpen = () => setIsOpen(true)
  const onClose = () => setIsOpen(false)
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

  const mutation = useMutation({
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

  const onSubmit = (data: FormValues) => {
    const formData = new FormData()
    if (data.url) {
      formData.append('url', data.url)
    }
    if (data.pdf && data.pdf.length > 0) {
      formData.append('pdf', data.pdf[0])
    }
    mutation.mutate(formData)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <>
      <Toaster />
      <Flex w="full" p={4} borderBottomWidth="1px" gap={4} alignItems="center">
        <Button onClick={onOpen}>Add Document</Button>
      </Flex>

      <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
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
                loading={isSubmitting || mutation.isPending}
                disabled={!pdfValue?.length && !urlValue}
              >
                Submit
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </form>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  )
}