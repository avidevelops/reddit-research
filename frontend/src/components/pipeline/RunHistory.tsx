import {
    Badge,
    Button,
    Card,
    CardBody,
    Flex,
    Heading,
    HStack,
    Icon,
    Link,
    Spinner,
    Table,
    TableContainer,
    Tbody,
    Td,
    Text,
    Th,
    Thead,
    Tr,
    useToast,
} from '@chakra-ui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiDownload, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';
import { deletePipelineRun, getPipelineExportUrl, listPipelineRuns, resumePipelineRun } from '../../services/api';
import type { PipelineRun } from '../../types/api';
import { formatDate, scoreColor } from './viewUtils';

const RunHistory = () => {
    const queryClient = useQueryClient();
    const toast = useToast();
    const { data: runs = [], isLoading, isError, error } = useQuery({
        queryKey: ['pipeline-runs'],
        queryFn: listPipelineRuns,
    });

    const deleteMutation = useMutation({
        mutationFn: deletePipelineRun,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['pipeline-runs'] });
            toast({ title: 'Run deleted', status: 'success' });
        },
    });

    const resumeMutation = useMutation({
        mutationFn: async (runId: string) => {
            let completedRun: PipelineRun | undefined;
            await resumePipelineRun(runId, ({ event, data }) => {
                if (event === 'complete') completedRun = data as PipelineRun;
            });
            return completedRun;
        },
        onSuccess: async (run) => {
            await queryClient.invalidateQueries({ queryKey: ['pipeline-runs'] });
            toast({
                title: run ? 'Pipeline resumed and completed' : 'Pipeline resume completed',
                status: 'success',
            });
        },
        onError: async (error: Error) => {
            await queryClient.invalidateQueries({ queryKey: ['pipeline-runs'] });
            toast({ title: 'Resume failed', description: error.message, status: 'error' });
        },
    });

    return (
        <Card>
            <CardBody>
                <Flex justify="space-between" align="center" mb={5}>
                    <Heading size="lg">Run History</Heading>
                    <Button as={RouterLink} to="/" colorScheme="blue">New Run</Button>
                </Flex>

                {isLoading ? (
                    <HStack><Spinner /><Text>Loading runs...</Text></HStack>
                ) : isError ? (
                    <Text color="red.500">Could not load run history: {error instanceof Error ? error.message : 'unknown error'}</Text>
                ) : runs.length === 0 ? (
                    <Text color="gray.500">No saved runs found in story-outputs yet.</Text>
                ) : (
                    <TableContainer>
                        <Table variant="simple">
                            <Thead>
                                <Tr>
                                    <Th>Topic</Th>
                                    <Th>Date</Th>
                                    <Th>Status</Th>
                                    <Th isNumeric>Quality</Th>
                                    <Th isNumeric>Read Time</Th>
                                    <Th isNumeric>Words</Th>
                                    <Th>Exports</Th>
                                    <Th />
                                </Tr>
                            </Thead>
                            <Tbody>
                                {runs.map(run => (
                                    <Tr key={run.id}>
                                        <Td>
                                            {run.status === 'completed' ? (
                                                <Link as={RouterLink} to={`/runs/${run.id}`} fontWeight="semibold">
                                                    {run.topic}
                                                </Link>
                                            ) : (
                                                <Text fontWeight="semibold">{run.topic}</Text>
                                            )}
                                            <Text fontSize="xs" color="gray.500">{run.directory}</Text>
                                        </Td>
                                        <Td>{formatDate(run.createdAt)}</Td>
                                        <Td>
                                            <Badge colorScheme={run.status === 'completed' ? 'green' : run.status === 'running' ? 'blue' : 'red'}>
                                                {run.status === 'completed'
                                                    ? 'Completed'
                                                    : run.status === 'running'
                                                        ? 'Running'
                                                        : `Failed: ${run.failedStage || 'interrupted'}`}
                                            </Badge>
                                            {run.error && <Text fontSize="xs" color="red.500" maxW="280px">{run.error}</Text>}
                                        </Td>
                                        <Td isNumeric>
                                            {run.score === undefined ? '—' : <Badge colorScheme={scoreColor(run.score)}>{run.score}</Badge>}
                                        </Td>
                                        <Td isNumeric>{run.estimatedReadTime} min</Td>
                                        <Td isNumeric>{run.wordCount}</Td>
                                        <Td>
                                            {run.status === 'completed' ? <HStack>
                                                <Button as="a" size="sm" href={getPipelineExportUrl(run.id, 'markdown')} leftIcon={<Icon as={FiDownload} />}>MD</Button>
                                                <Button as="a" size="sm" href={getPipelineExportUrl(run.id, 'html')}>HTML</Button>
                                                <Button as="a" size="sm" href={getPipelineExportUrl(run.id, 'plaintext')}>TXT</Button>
                                            </HStack> : '—'}
                                        </Td>
                                        <Td isNumeric>
                                            {run.resumable && (
                                                <Button
                                                    size="sm"
                                                    colorScheme="blue"
                                                    variant="outline"
                                                    leftIcon={<Icon as={FiRefreshCw} />}
                                                    isLoading={resumeMutation.isPending && resumeMutation.variables === run.id}
                                                    onClick={() => resumeMutation.mutate(run.id)}
                                                    mr={2}
                                                >
                                                    Resume
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                colorScheme="red"
                                                variant="ghost"
                                                leftIcon={<Icon as={FiTrash2} />}
                                                isLoading={deleteMutation.isPending}
                                                onClick={() => deleteMutation.mutate(run.id)}
                                            >
                                                Delete
                                            </Button>
                                        </Td>
                                    </Tr>
                                ))}
                            </Tbody>
                        </Table>
                    </TableContainer>
                )}
            </CardBody>
        </Card>
    );
};

export default RunHistory;
