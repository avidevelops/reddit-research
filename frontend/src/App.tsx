import { Box, Button, Container, Flex, Heading, HStack, useColorModeValue } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Link as RouterLink, Route, Routes } from 'react-router-dom'
import './App.css'
import PipelineLauncher from './components/pipeline/PipelineLauncher'
import RunDetail from './components/pipeline/RunDetail'
import RunHistory from './components/pipeline/RunHistory'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Box minH="100vh" bg={useColorModeValue("gray.50", "gray.900")}>
          <Box borderBottomWidth="1px" bg={useColorModeValue("white", "gray.950")}>
            <Container maxW="8xl" py={4}>
              <Flex justify="space-between" align="center">
                <Heading size="md">Reddit Research Pipeline</Heading>
                <HStack>
                  <Button as={RouterLink} to="/" variant="ghost">Launcher</Button>
                  <Button as={RouterLink} to="/runs" variant="ghost">Runs</Button>
                </HStack>
              </Flex>
            </Container>
          </Box>
          <Container maxW="8xl" py={8}>
            <Routes>
              <Route path="/" element={<PipelineLauncher />} />
              <Route path="/runs" element={<RunHistory />} />
              <Route path="/runs/:runId" element={<RunDetail />} />
            </Routes>
          </Container>
        </Box>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
