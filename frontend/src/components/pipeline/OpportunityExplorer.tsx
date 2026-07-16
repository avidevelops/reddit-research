import {
    Badge,
    Box,
    Button,
    Card,
    CardBody,
    CardHeader,
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
    Textarea,
    useToast,
    VStack,
    Wrap,
    WrapItem,
} from '@chakra-ui/react';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { FiDownload, FiEye, FiPlay, FiSearch, FiZap } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';
import { discoverPipelineOpportunities, getPipelineExportUrl, streamStoryPipeline } from '../../services/api';
import { usePipelineStore } from '../../store/pipelineStore';
import type { PipelineRequest, PipelineRun, PipelineStageEvent, TopicOpportunity, WritingMode } from '../../types/api';
import { getThemePreset, themeOptions, writingModeOptions } from './pipelineOptions';
import { scoreColor, stageLabel, stageOrder } from './viewUtils';

const splitSubreddits = (value: string): string[] =>
    value.split(',').map(item => item.trim().replace(/^r\//i, '')).filter(Boolean);

const isPipelineRun = (value: unknown): value is PipelineRun =>
    typeof value === 'object' && value !== null && typeof (value as PipelineRun).id === 'string';

const isStageEvent = (value: unknown): value is PipelineStageEvent =>
    typeof value === 'object' && value !== null && typeof (value as PipelineStageEvent).stage === 'string';

const categoryColors: Record<string, string> = {
    Technology: 'blue',
    'Software development': 'purple',
    'AI-Artificial Intelligence': 'teal',
    Life: 'green',
    'Self-improvement': 'yellow',
    Work: 'orange',
    Society: 'red',
    Culture: 'pink',
    World: 'cyan',
    Finance: 'gray',
};

const trimOpportunityForRun = (opportunity: TopicOpportunity): TopicOpportunity => ({
    ...opportunity,
    relevantPosts: opportunity.relevantPosts.slice(0, 7).map(post => ({
        id: post.id,
        subreddit: post.subreddit,
        title: post.title,
        selftext: post.selftext?.slice(0, 1200),
        created_utc: post.created_utc,
        author: post.author,
        score: post.score,
        num_comments: post.num_comments,
        permalink: post.permalink,
    })),
});

const OpportunityExplorer = () => {
    const defaultPreset = getThemePreset('General interest');
    const [subreddits, setSubreddits] = useState(defaultPreset?.subreddits || '');
    const [timeframe, setTimeframe] = useState<PipelineRequest['timeframe']>('week');
    const [limit, setLimit] = useState(40);
    const [topicsToGather, setTopicsToGather] = useState(3);
    const [targetAudience, setTargetAudience] = useState(defaultPreset?.targetAudience || 'curious Medium readers interested in thoughtful, practical insight');
    const [articleStyle, setArticleStyle] = useState(defaultPreset?.articleStyle || 'insightful narrative essay with practical takeaways');
    const [outputDir, setOutputDir] = useState('story-outputs');
    const [theme, setTheme] = useState('General interest');
    const [customTheme, setCustomTheme] = useState('');
    const [writingMode, setWritingMode] = useState<WritingMode>('research-report');
    const [opportunities, setOpportunities] = useState<TopicOpportunity[]>([]);
    const [selectedId, setSelectedId] = useState<string>();
    const toast = useToast();
    const {
        isRunning,
        currentStage,
        sseProgress,
        latestRun,
        startRun,
        addProgress,
        completeRun,
        failRun,
    } = usePipelineStore();

    const discoverMutation = useMutation({
        mutationFn: (request: PipelineRequest) => discoverPipelineOpportunities(request),
        onSuccess: (response) => {
            setOpportunities(response.opportunities);
            toast({ title: `Found ${response.opportunities.length} opportunities`, status: 'success' });
        },
        onError: (error: any) => {
            toast({ title: 'Discovery failed', description: error?.message, status: 'error' });
        },
    });

    const resolvedTheme = theme === 'Custom' ? customTheme.trim() || 'General interest' : theme;

    const applyTheme = (nextTheme: string) => {
        setTheme(nextTheme);
        if (nextTheme === 'Custom') return;
        const preset = getThemePreset(nextTheme);
        if (!preset) return;
        setSubreddits(preset.subreddits);
        setTargetAudience(preset.targetAudience);
        setArticleStyle(preset.articleStyle);
    };

    const buildRequest = (): PipelineRequest | null => {
        const parsedSubreddits = splitSubreddits(subreddits);
        if (parsedSubreddits.length === 0) {
            toast({ title: 'Add at least one subreddit', status: 'warning' });
            return null;
        }

        return {
            subreddits: parsedSubreddits,
            timeframe,
            limit,
            topicsToGather,
            targetAudience,
            articleStyle,
            outputDir: outputDir.trim() || undefined,
            theme: resolvedTheme,
            writingMode,
        };
    };

    const discover = () => {
        const request = buildRequest();
        if (request) {
            discoverMutation.mutate(request);
        }
    };

    const runPipelineForOpportunity = async (opportunity: TopicOpportunity) => {
        const request = buildRequest();
        if (!request) return;

        setSelectedId(opportunity.id);
        startRun();
        try {
            await streamStoryPipeline({
                ...request,
                selectedOpportunity: trimOpportunityForRun(opportunity),
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
        } finally {
            setSelectedId(undefined);
        }
    };

    const currentIndex = Math.max(0, stageOrder.indexOf(currentStage));

    return (
        <VStack spacing={6} align="stretch">
            <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={4} direction={{ base: 'column', md: 'row' }}>
                <Box>
                    <Heading size="xl">Opportunities</Heading>
                    <Text color="gray.500">Discover story cards first, then run the Markdown pipeline for the idea you choose.</Text>
                </Box>
                <Button leftIcon={<Icon as={FiSearch} />} colorScheme="blue" onClick={discover} isLoading={discoverMutation.isPending}>
                    Discover
                </Button>
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
                            <FormLabel>Theme</FormLabel>
                            <Select value={theme} onChange={(event) => applyTheme(event.target.value)}>
                                {themeOptions.map(option => <option key={option} value={option}>{option}</option>)}
                            </Select>
                        </FormControl>
                        {theme === 'Custom' && (
                            <FormControl>
                                <FormLabel>Custom Theme</FormLabel>
                                <Input value={customTheme} onChange={(event) => setCustomTheme(event.target.value)} placeholder="Philosophy of work, spirituality, parenting..." />
                            </FormControl>
                        )}
                        <FormControl>
                            <FormLabel>Writing Mode</FormLabel>
                            <Select value={writingMode} onChange={(event) => setWritingMode(event.target.value as WritingMode)}>
                                {writingModeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </Select>
                        </FormControl>
                        <FormControl>
                            <FormLabel>Posts Per Subreddit</FormLabel>
                            <Input type="number" value={limit} min={10} max={100} onChange={(event) => setLimit(Number(event.target.value))} />
                        </FormControl>
                        <FormControl>
                            <FormLabel>Reference Depth</FormLabel>
                            <Input type="number" value={topicsToGather} min={1} max={5} onChange={(event) => setTopicsToGather(Number(event.target.value))} />
                        </FormControl>
                        <FormControl>
                            <FormLabel>Output Directory</FormLabel>
                            <Input value={outputDir} onChange={(event) => setOutputDir(event.target.value)} />
                        </FormControl>
                    </SimpleGrid>

                    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4} mt={4}>
                        <FormControl>
                            <FormLabel>Target Audience</FormLabel>
                            <Textarea value={targetAudience} onChange={(event) => setTargetAudience(event.target.value)} minH="88px" />
                        </FormControl>
                        <FormControl>
                            <FormLabel>Article Style</FormLabel>
                            <Textarea value={articleStyle} onChange={(event) => setArticleStyle(event.target.value)} minH="88px" />
                        </FormControl>
                    </SimpleGrid>
                </CardBody>
            </Card>

            {(isRunning || sseProgress.length > 0) && (
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
                    </CardBody>
                </Card>
            )}

            {opportunities.length > 0 && (
                <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4}>
                    {opportunities.map((opportunity) => (
                        <Card key={opportunity.id} borderWidth="1px">
                            <CardHeader pb={2}>
                                <Flex justify="space-between" align="start" gap={3}>
                                    <Heading size="sm">{opportunity.topic}</Heading>
                                    <Badge colorScheme={categoryColors[opportunity.category] || 'gray'}>{opportunity.category}</Badge>
                                </Flex>
                            </CardHeader>
                            <CardBody pt={0}>
                                <VStack align="stretch" spacing={3}>
                                    <HStack spacing={4}>
                                        <Stat>
                                            <StatNumber color={`${scoreColor(opportunity.score)}.400`}>{opportunity.score}</StatNumber>
                                            <StatLabel>Story Score</StatLabel>
                                        </Stat>
                                        <Stat>
                                            <StatNumber color="green.400">{opportunity.mediumSuccessProbability}%</StatNumber>
                                            <StatLabel>Medium Fit</StatLabel>
                                        </Stat>
                                    </HStack>
                                    <Text fontSize="sm" color="gray.500">r/{opportunity.sourceSubreddit}</Text>
                                    <Text fontSize="sm">{opportunity.whyItWorks}</Text>
                                    <Wrap>
                                        {opportunity.keyThemes.slice(0, 5).map(theme => (
                                            <WrapItem key={theme}>
                                                <Badge variant="subtle">{theme}</Badge>
                                            </WrapItem>
                                        ))}
                                    </Wrap>
                                    <VStack align="stretch" spacing={1}>
                                        {opportunity.storyAngles.slice(0, 3).map(angle => (
                                            <Text key={angle} fontSize="sm">- {angle}</Text>
                                        ))}
                                    </VStack>
                                    <Button
                                        leftIcon={<Icon as={FiPlay} />}
                                        colorScheme="blue"
                                        onClick={() => runPipelineForOpportunity(opportunity)}
                                        isLoading={isRunning && selectedId === opportunity.id}
                                    >
                                        Run pipeline
                                    </Button>
                                </VStack>
                            </CardBody>
                        </Card>
                    ))}
                </SimpleGrid>
            )}

            {latestRun && (
                <Card borderColor="green.500" borderWidth="1px">
                    <CardBody>
                        <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={4} direction={{ base: 'column', md: 'row' }}>
                            <Box>
                                <Heading size="md">{latestRun.articleBrief.title}</Heading>
                                <Text color="gray.500">Saved to {latestRun.artifacts.directory}</Text>
                            </Box>
                            <HStack>
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

export default OpportunityExplorer;
