import { Box, Container } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './App.css'
import SearchPage from './components/SearchPage'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Box minH="100vh" bg="gray.50">
        <Container maxW="container.xl" py={8}>
          <SearchPage />
        </Container>
      </Box>
    </QueryClientProvider>
  )
}

export default App
