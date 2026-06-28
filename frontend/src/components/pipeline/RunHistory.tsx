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
import { FiDownload, FiTrash2 } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';
import { deletePipelineRun, getPipelineExportUrl, listPipelineRuns } from '../../services/api';
import { formatDate, scoreColor } from './viewUtils';

const RunHistory = () => {
    const queryClient = useQueryClient();
    const toast = useToast();
    const { data: runs = [], isLoading } = useQuery({
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

    return (
        <Card>
            <CardBody>
                <Flex justify="space-between" align="center" mb={5}>
                    <Heading size="lg">Run History</Heading>
                    <Button as={RouterLink} to="/" colorScheme="blue">New Run</Button>
                </Flex>

                {isLoading ? (
                    <HStack><Spinner /><Text>Loading runs...</Text></HStack>
                ) : (
                    <TableContainer>
                        <Table variant="simple">
                            <Thead>
                                <Tr>
                                    <Th>Topic</Th>
                                    <Th>Date</Th>
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
                                            <Link as={RouterLink} to={`/runs/${run.id}`} fontWeight="semibold">
                                                {run.topic}
                                            </Link>
                                            <Text fontSize="xs" color="gray.500">{run.directory}</Text>
                                        </Td>
                                        <Td>{formatDate(run.createdAt)}</Td>
                                        <Td isNumeric>
                                            <Badge colorScheme={scoreColor(run.score)}>{run.score}</Badge>
                                        </Td>
                                        <Td isNumeric>{run.estimatedReadTime} min</Td>
                                        <Td isNumeric>{run.wordCount}</Td>
                                        <Td>
                                            <HStack>
                                                <Button as="a" size="sm" href={getPipelineExportUrl(run.id, 'markdown')} leftIcon={<Icon as={FiDownload} />}>MD</Button>
                                                <Button as="a" size="sm" href={getPipelineExportUrl(run.id, 'html')}>HTML</Button>
                                                <Button as="a" size="sm" href={getPipelineExportUrl(run.id, 'plaintext')}>TXT</Button>
                                            </HStack>
                                        </Td>
                                        <Td isNumeric>
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
