import {
    Badge,
    Box,
    Button,
    Card,
    CardBody,
    Flex,
    FormControl,
    FormLabel,
    Heading,
    HStack,
    Icon,
    Input,
    Progress,
    Select,
    SimpleGrid,
    Spinner,
    Stat,
    StatLabel,
    StatNumber,
    Text,
    useToast,
    VStack,
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { FiDownload, FiEye, FiPlay, FiZap } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';
import { getPipelineExportUrl, getPipelineProviders, streamStoryPipeline } from '../../services/api';
import { usePipelineStore } from '../../store/pipelineStore';
import type { PipelineRequest, PipelineRun, PipelineStageEvent } from '../../types/api';
import { scoreColor, stageLabel, stageOrder } from './viewUtils';

const splitSubreddits = (value: string): string[] =>
    value.split(',').map(item => item.trim().replace(/^r\//i, '')).filter(Boolean);

const isPipelineRun = (value: unknown): value is PipelineRun =>
    typeof value === 'object' && value !== null && typeof (value as PipelineRun).id === 'string';

const isStageEvent = (value: unknown): value is PipelineStageEvent =>
    typeof value === 'object' && value !== null && typeof (value as PipelineStageEvent).stage === 'string';

const PipelineLauncher = () => {
    const [subreddits, setSubreddits] = useState('technology,programming,artificial');
    const [timeframe, setTimeframe] = useState<PipelineRequest['timeframe']>('week');
    const [articleStyle, setArticleStyle] = useState('narrative essay');
    const [targetAudience, setTargetAudience] = useState('curious Medium readers interested in technology and practical insight');
    const [limit, setLimit] = useState(40);
    const [topicsToGather, setTopicsToGather] = useState(3);
    const toast = useToast();
    const {
        isRunning,
        currentStage,
        sseProgress,
        latestRun,
        providers,
        startRun,
        addProgress,
        completeRun,
        failRun,
        setProviders,
    } = usePipelineStore();

    const providersQuery = useQuery({
        queryKey: ['pipeline-providers'],
        queryFn: getPipelineProviders,
    });

    useEffect(() => {
        if (providersQuery.data) {
            setProviders(providersQuery.data);
        }
    }, [providersQuery.data, setProviders]);

    const runPipeline = async () => {
        const parsedSubreddits = splitSubreddits(subreddits);
        if (parsedSubreddits.length === 0) {
            toast({ title: 'Add at least one subreddit', status: 'warning' });
            return;
        }

        startRun();
        try {
            await streamStoryPipeline({
                subreddits: parsedSubreddits,
                timeframe,
                articleStyle,
                targetAudience,
                limit,
                topicsToGather,
            }, ({ event, data }) => {
                if (event === 'stage' && isStageEvent(data)) {
                    addProgress(data);
                }
                if (event === 'complete' && isPipelineRun(data)) {
                    completeRun(data);
                    toast({ title: 'Pipeline complete', status: 'success' });
                }
                if (event === 'error') {
                    failRun('Pipeline failed');
                }
            });
        } catch (error: any) {
            failRun(error?.message || 'Pipeline failed');
            toast({ title: 'Pipeline failed', description: error?.message, status: 'error' });
        }
    };

    const currentIndex = Math.max(0, stageOrder.indexOf(currentStage));

    return (
        <VStack spacing={6} align="stretch">
            <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={4} direction={{ base: 'column', md: 'row' }}>
                <Box>
                    <Heading size="xl">Story Pipeline</Heading>
                    <Text color="gray.500">Research Reddit, score ideas, draft, edit, and save Markdown stories.</Text>
                </Box>
                <HStack>
                    {providers && (
                        <Badge colorScheme="purple" px={3} py={1}>
                            {providers.activeProvider} / {providers.model}
                        </Badge>
                    )}
                    <Button as={RouterLink} to="/runs" variant="outline">Runs</Button>
                    <Button leftIcon={<Icon as={FiPlay} />} colorScheme="blue" onClick={runPipeline} isLoading={isRunning}>
                        Run Pipeline
                    </Button>
                </HStack>
            </Flex>

            <Card>
                <CardBody>
                    <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4}>
                        <FormControl>
                            <FormLabel>Subreddits</FormLabel>
                            <Input value={subreddits} onChange={(event) => setSubreddits(event.target.value)} />
                        </FormControl>
                        <FormControl>
                            <FormLabel>Timeframe</FormLabel>
                            <Select value={timeframe} onChange={(event) => setTimeframe(event.target.value as PipelineRequest['timeframe'])}>
                                <option value="day">Past day</option>
                                <option value="week">Past week</option>
                                <option value="month">Past month</option>
                            </Select>
                        </FormControl>
                        <FormControl>
                            <FormLabel>Article Style</FormLabel>
                            <Select value={articleStyle} onChange={(event) => setArticleStyle(event.target.value)}>
                                <option value="narrative essay">Narrative essay</option>
                                <option value="listicle">Listicle</option>
                                <option value="opinion">Opinion</option>
                                <option value="how-to">How-to</option>
                            </Select>
                        </FormControl>
                        <FormControl>
                            <FormLabel>Target Audience</FormLabel>
                            <Input value={targetAudience} onChange={(event) => setTargetAudience(event.target.value)} />
                        </FormControl>
                        <FormControl>
                            <FormLabel>Posts Per Subreddit</FormLabel>
                            <Input type="number" value={limit} min={10} max={100} onChange={(event) => setLimit(Number(event.target.value))} />
                        </FormControl>
                        <FormControl>
                            <FormLabel>Reference Depth</FormLabel>
                            <Input type="number" value={topicsToGather} min={1} max={5} onChange={(event) => setTopicsToGather(Number(event.target.value))} />
                        </FormControl>
                    </SimpleGrid>
                </CardBody>
            </Card>

            <Card>
                <CardBody>
                    <SimpleGrid columns={{ base: 2, md: 4, lg: stageOrder.length }} spacing={3}>
                        {stageOrder.map((stage, index) => {
                            const active = stage === currentStage;
                            const done = currentStage === 'complete' || index < currentIndex;
                            return (
                                <HStack key={stage} opacity={done || active ? 1 : 0.45}>
                                    <Icon as={FiZap} color={done ? 'green.400' : active ? 'blue.400' : 'gray.500'} />
                                    <Text fontSize="sm" fontWeight="semibold">{stageLabel[stage]}</Text>
                                </HStack>
                            );
                        })}
                    </SimpleGrid>
                    {isRunning && (
                        <Box mt={4}>
                            <Progress isIndeterminate colorScheme="blue" size="sm" />
                            <HStack mt={3} color="gray.500">
                                <Spinner size="sm" />
                                <Text fontSize="sm">Current stage: {stageLabel[currentStage] || currentStage}</Text>
                            </HStack>
                        </Box>
                    )}
                    {sseProgress.length > 0 && (
                        <VStack mt={4} align="stretch" spacing={1}>
                            {sseProgress.slice(-5).map((event, index) => (
                                <Text key={`${event.stage}-${index}`} fontSize="xs" color="gray.500">
                                    {stageLabel[event.stage] || event.stage}: {JSON.stringify(event)}
                                </Text>
                            ))}
                        </VStack>
                    )}
                </CardBody>
            </Card>

            {latestRun && (
                <Card borderColor="green.500" borderWidth="1px">
                    <CardBody>
                        <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={4} direction={{ base: 'column', md: 'row' }}>
                            <Box>
                                <Heading size="md">{latestRun.articleBrief.title}</Heading>
                                <Text color="gray.500">Saved to {latestRun.artifacts.directory}</Text>
                            </Box>
                            <HStack>
                                <Stat>
                                    <StatNumber color={`${scoreColor(latestRun.editorialReview.qualityGate?.score ?? latestRun.editorialReview.score)}.400`}>
                                        {latestRun.editorialReview.qualityGate?.score ?? latestRun.editorialReview.score}
                                    </StatNumber>
                                    <StatLabel>Quality</StatLabel>
                                </Stat>
                                <Stat>
                                    <StatNumber>{latestRun.draft.estimatedReadTime}</StatNumber>
                                    <StatLabel>Min read</StatLabel>
                                </Stat>
                                <Button as={RouterLink} to={`/runs/${latestRun.id}`} leftIcon={<Icon as={FiEye} />}>
                                    View
                                </Button>
                                <Button as="a" href={getPipelineExportUrl(latestRun.id)} leftIcon={<Icon as={FiDownload} />} variant="outline">
                                    .md
                                </Button>
                            </HStack>
                        </Flex>
                    </CardBody>
                </Card>
            )}
        </VStack>
    );
};

export default PipelineLauncher;
