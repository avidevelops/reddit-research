import {
    Badge,
    Box,
    Button,
    Card,
    CardBody,
    CardHeader,
    Divider,
    Flex,
    Grid,
    Heading,
    HStack,
    Icon,
    Input,
    Link,
    Select,
    Spinner,
    Text,
    useToast,
    VStack,
} from '@chakra-ui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { FiCopy, FiDownload, FiRefreshCw } from 'react-icons/fi';
import { Link as RouterLink, useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchPipelineExport, getPipelineArtifactUrl, getPipelineExportUrl, getPipelineRun, regeneratePipelineSection } from '../../services/api';
import { formatDate, qualityChartData, scoreColor } from './viewUtils';

const RunDetail = () => {
    const { runId = '' } = useParams();
    const [sectionIndex, setSectionIndex] = useState(0);
    const [instruction, setInstruction] = useState('');
    const queryClient = useQueryClient();
    const toast = useToast();

    const { data: run, isLoading } = useQuery({
        queryKey: ['pipeline-run', runId],
        queryFn: () => getPipelineRun(runId),
        enabled: Boolean(runId),
    });

    const regenerateMutation = useMutation({
        mutationFn: () => regeneratePipelineSection(runId, sectionIndex, instruction || undefined),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['pipeline-run', runId] });
            toast({ title: 'Section regenerated', status: 'success' });
        },
    });

    const copyExport = async (format: 'html' | 'plaintext') => {
        const content = await fetchPipelineExport(runId, format);
        await navigator.clipboard.writeText(content);
        toast({ title: `${format === 'html' ? 'HTML' : 'Plain text'} copied`, status: 'success' });
    };

    if (isLoading || !run) {
        return <HStack><Spinner /><Text>Loading run...</Text></HStack>;
    }

    const qualityScore = run.editorialReview.qualityGate?.score ?? run.editorialReview.score;
    const chartData = qualityChartData(run.editorialReview.qualityGate?.dimensionScores);

    return (
        <VStack spacing={5} align="stretch">
            <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={4} direction={{ base: 'column', md: 'row' }}>
                <Box>
                    <HStack mb={2}>
                        <Link as={RouterLink} to="/runs">Runs</Link>
                        <Text color="gray.500">/</Text>
                        <Text color="gray.500">{formatDate(run.createdAt)}</Text>
                    </HStack>
                    <Heading size="lg">{run.articleBrief.title}</Heading>
                </Box>
                <Flex gap={2} wrap="wrap" align="center">
                    <Badge colorScheme={scoreColor(qualityScore)} px={3} py={1}>Quality {qualityScore}</Badge>
                    <Button as="a" href={getPipelineArtifactUrl(run.id, 'research-bundle')} target="_blank" variant="outline">Research</Button>
                    <Button as="a" href={getPipelineArtifactUrl(run.id, 'reference-summary')} target="_blank" variant="outline">Reference Notes</Button>
                    <Button as="a" href={getPipelineExportUrl(run.id, 'markdown')} leftIcon={<Icon as={FiDownload} />}>Download .md</Button>
                    <Button onClick={() => copyExport('html')} leftIcon={<Icon as={FiCopy} />} variant="outline">Copy HTML</Button>
                    <Button onClick={() => copyExport('plaintext')} variant="outline">Copy Text</Button>
                </Flex>
            </Flex>

            <Grid templateColumns={{ base: '1fr', xl: '300px 1fr 320px' }} gap={5}>
                <VStack align="stretch" spacing={4}>
                    <Card>
                        <CardHeader><Heading size="sm">Brief</Heading></CardHeader>
                        <CardBody>
                            <VStack align="stretch" spacing={3}>
                                <Box>
                                    <Text fontSize="xs" color="gray.500">Thesis</Text>
                                    <Text fontSize="sm">{run.articleBrief.thesis}</Text>
                                </Box>
                                <Box>
                                    <Text fontSize="xs" color="gray.500">Audience</Text>
                                    <Text fontSize="sm">{run.articleBrief.targetAudience}</Text>
                                </Box>
                                <Box>
                                    <Text fontSize="xs" color="gray.500">Hooks</Text>
                                    {run.articleBrief.hookOptions.map(hook => <Text key={hook} fontSize="sm">- {hook}</Text>)}
                                </Box>
                                <Box>
                                    <Text fontSize="xs" color="gray.500">Risks</Text>
                                    {run.articleBrief.risks.map(risk => <Text key={risk} fontSize="sm">- {risk}</Text>)}
                                </Box>
                            </VStack>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardHeader><Heading size="sm">Regenerate Section</Heading></CardHeader>
                        <CardBody>
                            <VStack align="stretch">
                                <Select value={sectionIndex} onChange={(event) => setSectionIndex(Number(event.target.value))}>
                                    {run.articleBrief.outline.map((section, index) => (
                                        <option key={`${section.heading}-${index}`} value={index}>
                                            {index + 1}. {section.heading}
                                        </option>
                                    ))}
                                </Select>
                                <Input
                                    placeholder="Optional instruction"
                                    value={instruction}
                                    onChange={(event) => setInstruction(event.target.value)}
                                />
                                <Button
                                    leftIcon={<Icon as={FiRefreshCw} />}
                                    isLoading={regenerateMutation.isPending}
                                    onClick={() => regenerateMutation.mutate()}
                                >
                                    Regenerate
                                </Button>
                            </VStack>
                        </CardBody>
                    </Card>
                </VStack>

                <Card>
                    <CardBody>
                        <Box className="markdown-body">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {run.editorialReview.finalMarkdown}
                            </ReactMarkdown>
                        </Box>
                    </CardBody>
                </Card>

                <VStack align="stretch" spacing={4}>
                    <Card>
                        <CardHeader><Heading size="sm">Quality Dimensions</Heading></CardHeader>
                        <CardBody>
                            {chartData.length > 0 ? (
                                <Box h="260px">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" domain={[0, 100]} />
                                            <YAxis type="category" dataKey="dimension" width={110} fontSize={11} />
                                            <Tooltip />
                                            <Bar dataKey="score" fill="#4299e1" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Box>
                            ) : (
                                <Text color="gray.500">No quality gate data saved for this run.</Text>
                            )}
                        </CardBody>
                    </Card>

                    <Card>
                        <CardHeader><Heading size="sm">Feedback</Heading></CardHeader>
                        <CardBody>
                            <Text fontSize="xs" color="gray.500">Blockers</Text>
                            {(run.editorialReview.qualityGate?.blockers || []).map(item => <Text key={item} fontSize="sm">- {item}</Text>)}
                            <Divider my={3} />
                            <Text fontSize="xs" color="gray.500">Suggestions</Text>
                            {(run.editorialReview.qualityGate?.suggestions || []).map(item => <Text key={item} fontSize="sm">- {item}</Text>)}
                        </CardBody>
                    </Card>
                </VStack>
            </Grid>
        </VStack>
    );
};

export default RunDetail;
