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
import { FiDownload, FiEye, FiLink, FiPlay, FiZap } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';
import { getPipelineExportUrl, getPipelineProviders, streamStoryPipeline } from '../../services/api';
import { usePipelineStore } from '../../store/pipelineStore';
import type { PipelineRequest, PipelineRun, PipelineStageEvent, WritingMode } from '../../types/api';
import { getThemePreset, themeOptions, writingModeOptions } from './pipelineOptions';
import { scoreColor, stageLabel, stageOrder } from './viewUtils';

const splitSubreddits = (value: string): string[] =>
    value.split(',').map(item => item.trim().replace(/^r\//i, '')).filter(Boolean);

const isPipelineRun = (value: unknown): value is PipelineRun =>
    typeof value === 'object' && value !== null && typeof (value as PipelineRun).id === 'string';

const isStageEvent = (value: unknown): value is PipelineStageEvent =>
    typeof value === 'object' && value !== null && typeof (value as PipelineStageEvent).stage === 'string';

const PipelineLauncher = () => {
    const defaultPreset = getThemePreset('General interest');
    const [subreddits, setSubreddits] = useState(defaultPreset?.subreddits || '');
    const [timeframe, setTimeframe] = useState<PipelineRequest['timeframe']>('week');
    const [articleStyle, setArticleStyle] = useState(defaultPreset?.articleStyle || 'insightful narrative essay with practical takeaways');
    const [targetAudience, setTargetAudience] = useState(defaultPreset?.targetAudience || 'curious Medium readers interested in thoughtful, practical insight');
    const [theme, setTheme] = useState('General interest');
    const [customTheme, setCustomTheme] = useState('');
    const [writingMode, setWritingMode] = useState<WritingMode>('research-report');
    const [outputDir, setOutputDir] = useState('story-outputs');
    const [limit, setLimit] = useState(40);
    const [topicsToGather, setTopicsToGather] = useState(3);
    const [redditPostUrl, setRedditPostUrl] = useState('');
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

    const applyTheme = (nextTheme: string) => {
        setTheme(nextTheme);
        if (nextTheme === 'Custom') return;
        const preset = getThemePreset(nextTheme);
        if (!preset) return;
        setSubreddits(preset.subreddits);
        setTargetAudience(preset.targetAudience);
        setArticleStyle(preset.articleStyle);
    };

    const runPipeline = async (source: 'lucky' | 'reddit-post') => {
        const parsedSubreddits = splitSubreddits(subreddits);
        const directUrl = redditPostUrl.trim();
        if (source === 'lucky' && parsedSubreddits.length === 0) {
            toast({ title: 'Add at least one subreddit', status: 'warning' });
            return;
        }
        if (source === 'reddit-post' && !directUrl) {
            toast({ title: 'Paste a Reddit post URL', status: 'warning' });
            return;
        }

        const resolvedTheme = theme === 'Custom' ? customTheme.trim() || 'General interest' : theme;
        startRun();
        try {
            await streamStoryPipeline({
                subreddits: source === 'lucky' ? parsedSubreddits : undefined,
                redditPostUrl: source === 'reddit-post' ? directUrl : undefined,
                timeframe,
                articleStyle,
                targetAudience,
                theme: resolvedTheme,
                writingMode,
                outputDir: outputDir.trim() || undefined,
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
                    <Heading size="xl">Lucky Run</Heading>
                    <Text color="gray.500">Let the pipeline pick the best opportunity, draft, edit, and save Markdown artifacts.</Text>
                </Box>
                <HStack>
                    {providers && (
                        <Badge colorScheme="purple" px={3} py={1}>
                            {providers.activeProvider} / {providers.model}
                        </Badge>
                    )}
                    <Button leftIcon={<Icon as={FiPlay} />} colorScheme="blue" onClick={() => runPipeline('lucky')} isLoading={isRunning}>
                        Start pipeline
                    </Button>
                </HStack>
            </Flex>

            <Card borderColor="purple.200" borderWidth="1px">
                <CardBody>
                    <Flex gap={4} align={{ base: 'stretch', md: 'end' }} direction={{ base: 'column', md: 'row' }}>
                        <FormControl flex="1">
                            <FormLabel>Generate from a Reddit post</FormLabel>
                            <Input
                                type="url"
                                placeholder="https://www.reddit.com/r/.../comments/..."
                                value={redditPostUrl}
                                onChange={(event) => setRedditPostUrl(event.target.value)}
                            />
                            <Text fontSize="xs" color="gray.500" mt={1}>
                                Supports Reddit post links, share links, and redd.it links. The pipeline uses the post and its discussion as source material.
                            </Text>
                        </FormControl>
                        <Button
                            leftIcon={<Icon as={FiLink} />}
                            colorScheme="purple"
                            onClick={() => runPipeline('reddit-post')}
                            isLoading={isRunning}
                        >
                            Generate story
                        </Button>
                    </Flex>
                </CardBody>
            </Card>

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
                            <FormLabel>Theme</FormLabel>
                            <Select value={theme} onChange={(event) => applyTheme(event.target.value)}>
                                {themeOptions.map(option => <option key={option} value={option}>{option}</option>)}
                            </Select>
                        </FormControl>
                        {theme === 'Custom' && (
                            <FormControl>
                                <FormLabel>Custom Theme</FormLabel>
                                <Input value={customTheme} onChange={(event) => setCustomTheme(event.target.value)} />
                            </FormControl>
                        )}
                        <FormControl>
                            <FormLabel>Writing Mode</FormLabel>
                            <Select value={writingMode} onChange={(event) => setWritingMode(event.target.value as WritingMode)}>
                                {writingModeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
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
                        <FormControl>
                            <FormLabel>Output Directory</FormLabel>
                            <Input value={outputDir} onChange={(event) => setOutputDir(event.target.value)} />
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
