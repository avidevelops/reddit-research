import {
    Badge,
    Box,
    Button,
    Card,
    CardBody,
    CardHeader,
    Code,
    Divider,
    Flex,
    Grid,
    Heading,
    HStack,
    Icon,
    Input,
    NumberDecrementStepper,
    NumberIncrementStepper,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    Progress,
    Select,
    SimpleGrid,
    Spinner,
    Stat,
    StatLabel,
    StatNumber,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    Text,
    Textarea,
    useToast,
    VStack,
    Wrap,
    WrapItem,
} from '@chakra-ui/react';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { FiBookOpen, FiCheckCircle, FiEdit3, FiFileText, FiFolder, FiSearch, FiTrendingUp } from 'react-icons/fi';
import { runStoryPipeline } from '../services/api';
import type { PipelineRequest, PipelineRun } from '../types/api';
import { getThemePreset } from './pipeline/pipelineOptions';

const stageLabels = ['Discover', 'Score', 'Research', 'Brief', 'Draft', 'Edit', 'Export'];

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

const splitSubreddits = (value: string): string[] =>
    value.split(',')
        .map(item => item.trim().replace(/^r\//i, ''))
        .filter(Boolean);

const BulletList = ({ items, empty = 'Nothing captured yet.' }: { items?: string[]; empty?: string }) => (
    <VStack align="stretch" spacing={1}>
        {items && items.length > 0 ? items.map((item, index) => (
            <Text key={`${item}-${index}`} fontSize="sm">- {item}</Text>
        )) : <Text fontSize="sm" color="gray.500">{empty}</Text>}
    </VStack>
);

const MarkdownPreview = ({ markdown }: { markdown: string }) => (
    <Box
        as="pre"
        whiteSpace="pre-wrap"
        overflowX="auto"
        bg="gray.900"
        color="gray.50"
        p={4}
        borderRadius="md"
        fontSize="sm"
        lineHeight="1.7"
        maxH="620px"
    >
        {markdown}
    </Box>
);

const TrendingTopics = () => {
    const defaultPreset = getThemePreset('General interest');
    const [subreddits, setSubreddits] = useState(defaultPreset?.subreddits || 'AskReddit,todayilearned,changemyview');
    const [timeframe, setTimeframe] = useState<PipelineRequest['timeframe']>('week');
    const [limit, setLimit] = useState(40);
    const [topicsToGather, setTopicsToGather] = useState(3);
    const [targetAudience, setTargetAudience] = useState(defaultPreset?.targetAudience || 'curious Medium readers interested in thoughtful, practical insight');
    const [articleStyle, setArticleStyle] = useState(defaultPreset?.articleStyle || 'sharp narrative essay with practical takeaways and source-backed insight');
    const [outputDir, setOutputDir] = useState('story-outputs');
    const toast = useToast();

    const pipelineMutation = useMutation({
        mutationFn: (request: PipelineRequest) => runStoryPipeline(request),
        onSuccess: (run: PipelineRun) => {
            toast({
                title: 'Story pipeline complete',
                description: `Saved Markdown artifacts to ${run.artifacts.directory}`,
                status: 'success',
                duration: 7000,
                isClosable: true,
            });
        },
        onError: () => {
            toast({
                title: 'Pipeline failed',
                description: 'Check server logs and API credentials, then try again.',
                status: 'error',
                duration: 7000,
                isClosable: true,
            });
        },
    });

    const run = pipelineMutation.data;

    const handleRunPipeline = () => {
        const parsedSubreddits = splitSubreddits(subreddits);
        if (parsedSubreddits.length === 0) {
            toast({
                title: 'Add at least one subreddit',
                status: 'warning',
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        pipelineMutation.mutate({
            subreddits: parsedSubreddits,
            timeframe,
            limit,
            topicsToGather,
            targetAudience,
            articleStyle,
            outputDir: outputDir.trim() || undefined,
        });
    };

    return (
        <VStack spacing={6} align="stretch">
            <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={4} direction={{ base: 'column', md: 'row' }}>
                <Box>
                    <Heading size="xl">Reddit Research To Markdown Story Pipeline</Heading>
                    <Text color="gray.600" mt={1}>Find a story, research it, draft it, edit it, and save Markdown artifacts locally.</Text>
                </Box>
                <Button
                    colorScheme="blue"
                    size="lg"
                    leftIcon={<Icon as={FiFileText} />}
                    onClick={handleRunPipeline}
                    isLoading={pipelineMutation.isPending}
                >
                    Run Pipeline
                </Button>
            </Flex>

            <Card>
                <CardBody>
                    <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr 1fr 1fr' }} gap={4}>
                        <Box>
                            <Text fontSize="sm" fontWeight="semibold" mb={2}>Subreddits</Text>
                            <Input
                                value={subreddits}
                                onChange={(event) => setSubreddits(event.target.value)}
                                placeholder="AskReddit, todayilearned, changemyview"
                            />
                        </Box>
                        <Box>
                            <Text fontSize="sm" fontWeight="semibold" mb={2}>Timeframe</Text>
                            <Select value={timeframe} onChange={(event) => setTimeframe(event.target.value as PipelineRequest['timeframe'])}>
                                <option value="day">Past day</option>
                                <option value="week">Past week</option>
                                <option value="month">Past month</option>
                            </Select>
                        </Box>
                        <Box>
                            <Text fontSize="sm" fontWeight="semibold" mb={2}>Posts</Text>
                            <NumberInput min={10} max={100} value={limit} onChange={(_, value) => setLimit(value)}>
                                <NumberInputField />
                                <NumberInputStepper>
                                    <NumberIncrementStepper />
                                    <NumberDecrementStepper />
                                </NumberInputStepper>
                            </NumberInput>
                        </Box>
                        <Box>
                            <Text fontSize="sm" fontWeight="semibold" mb={2}>Reference Depth</Text>
                            <NumberInput min={1} max={5} value={topicsToGather} onChange={(_, value) => setTopicsToGather(value)}>
                                <NumberInputField />
                                <NumberInputStepper>
                                    <NumberIncrementStepper />
                                    <NumberDecrementStepper />
                                </NumberInputStepper>
                            </NumberInput>
                        </Box>
                    </Grid>

                    <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr 280px' }} gap={4} mt={4}>
                        <Box>
                            <Text fontSize="sm" fontWeight="semibold" mb={2}>Target Audience</Text>
                            <Textarea
                                value={targetAudience}
                                onChange={(event) => setTargetAudience(event.target.value)}
                                minH="88px"
                            />
                        </Box>
                        <Box>
                            <Text fontSize="sm" fontWeight="semibold" mb={2}>Article Style</Text>
                            <Textarea
                                value={articleStyle}
                                onChange={(event) => setArticleStyle(event.target.value)}
                                minH="88px"
                            />
                        </Box>
                        <Box>
                            <Text fontSize="sm" fontWeight="semibold" mb={2}>Output Directory</Text>
                            <Input
                                value={outputDir}
                                onChange={(event) => setOutputDir(event.target.value)}
                                placeholder="story-outputs"
                            />
                            <Text fontSize="xs" color="gray.500" mt={2}>Project-relative path only. Markdown is saved here; no Medium publishing is performed.</Text>
                        </Box>
                    </Grid>
                </CardBody>
            </Card>

            <Card>
                <CardBody>
                    <SimpleGrid columns={{ base: 2, md: 7 }} spacing={3}>
                        {stageLabels.map((stage, index) => {
                            const isComplete = Boolean(run);
                            return (
                                <HStack key={stage} spacing={2}>
                                    <Icon as={isComplete ? FiCheckCircle : index === 0 && pipelineMutation.isPending ? FiSearch : FiBookOpen} color={isComplete ? 'green.500' : 'gray.500'} />
                                    <Text fontSize="sm" fontWeight="semibold">{stage}</Text>
                                </HStack>
                            );
                        })}
                    </SimpleGrid>
                    {pipelineMutation.isPending && (
                        <Box mt={4}>
                            <Progress size="sm" isIndeterminate colorScheme="blue" />
                            <HStack mt={3} color="gray.600">
                                <Spinner size="sm" />
                                <Text fontSize="sm">Running Reddit research, LLM generation, editorial review, and Markdown export...</Text>
                            </HStack>
                        </Box>
                    )}
                </CardBody>
            </Card>

            {run && (
                <Tabs colorScheme="blue" isLazy>
                    <TabList overflowX="auto">
                        <Tab>Opportunities</Tab>
                        <Tab>Research</Tab>
                        <Tab>Brief</Tab>
                        <Tab>Draft</Tab>
                        <Tab>Final Story</Tab>
                        <Tab>Exports</Tab>
                    </TabList>
                    <TabPanels>
                        <TabPanel px={0}>
                            <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={4}>
                                {run.opportunities.slice(0, 9).map((opportunity) => (
                                    <Card key={opportunity.id} borderColor={opportunity.id === run.selectedOpportunity.id ? 'blue.300' : 'gray.100'} borderWidth="1px">
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
                                                        <StatNumber color="blue.500">{opportunity.score}</StatNumber>
                                                        <StatLabel>Story Score</StatLabel>
                                                    </Stat>
                                                    <Stat>
                                                        <StatNumber color="green.500">{opportunity.mediumSuccessProbability}%</StatNumber>
                                                        <StatLabel>Medium Fit</StatLabel>
                                                    </Stat>
                                                </HStack>
                                                <Text fontSize="sm" color="gray.600">r/{opportunity.sourceSubreddit}</Text>
                                                <Text fontSize="sm">{opportunity.whyItWorks}</Text>
                                                <Wrap>
                                                    {opportunity.keyThemes.slice(0, 5).map(theme => (
                                                        <WrapItem key={theme}>
                                                            <Badge variant="subtle">{theme}</Badge>
                                                        </WrapItem>
                                                    ))}
                                                </Wrap>
                                            </VStack>
                                        </CardBody>
                                    </Card>
                                ))}
                            </SimpleGrid>
                        </TabPanel>

                        <TabPanel px={0}>
                            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
                                <Card>
                                    <CardHeader><Heading size="md">Key Insights</Heading></CardHeader>
                                    <CardBody><BulletList items={run.researchBundle.keyInsights} /></CardBody>
                                </Card>
                                <Card>
                                    <CardHeader><Heading size="md">Pain Points</Heading></CardHeader>
                                    <CardBody><BulletList items={run.researchBundle.painPoints} /></CardBody>
                                </Card>
                                <Card>
                                    <CardHeader><Heading size="md">Quotes</Heading></CardHeader>
                                    <CardBody>
                                        <VStack align="stretch" spacing={3}>
                                            {run.researchBundle.quotes.slice(0, 6).map((quote, index) => (
                                                <Box key={`${quote.voiceLabel || quote.author || 'quote'}-${index}`}>
                                                    <Text fontSize="sm">"{quote.text}"</Text>
                                                    <Text fontSize="xs" color="gray.500">{quote.voiceLabel || quote.author || 'anonymous voice'} - {quote.relevance}</Text>
                                                </Box>
                                            ))}
                                        </VStack>
                                    </CardBody>
                                </Card>
                                <Card>
                                    <CardHeader><Heading size="md">Source Posts</Heading></CardHeader>
                                    <CardBody>
                                        <VStack align="stretch" spacing={2}>
                                            {run.researchBundle.sourcePosts.map(post => (
                                                <Box key={post.id}>
                                                    <Text fontSize="sm" fontWeight="semibold">{post.title}</Text>
                                                    <Text fontSize="xs" color="gray.500">Score {post.score} - {post.num_comments} comments - {post.permalink}</Text>
                                                </Box>
                                            ))}
                                        </VStack>
                                    </CardBody>
                                </Card>
                            </SimpleGrid>
                        </TabPanel>

                        <TabPanel px={0}>
                            <Card>
                                <CardBody>
                                    <VStack align="stretch" spacing={5}>
                                        <Box>
                                            <Heading size="md">{run.articleBrief.title}</Heading>
                                            <Text color="gray.600" mt={2}>{run.articleBrief.thesis}</Text>
                                        </Box>
                                        <Divider />
                                        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={5}>
                                            <Box>
                                                <Heading size="sm" mb={2}>Headlines</Heading>
                                                <BulletList items={run.articleBrief.headlineOptions} />
                                            </Box>
                                            <Box>
                                                <Heading size="sm" mb={2}>Hooks</Heading>
                                                <BulletList items={run.articleBrief.hookOptions} />
                                            </Box>
                                            <Box>
                                                <Heading size="sm" mb={2}>Takeaways</Heading>
                                                <BulletList items={run.articleBrief.practicalTakeaways} />
                                            </Box>
                                            <Box>
                                                <Heading size="sm" mb={2}>Risks</Heading>
                                                <BulletList items={run.articleBrief.risks} />
                                            </Box>
                                        </SimpleGrid>
                                    </VStack>
                                </CardBody>
                            </Card>
                        </TabPanel>

                        <TabPanel px={0}>
                            <MarkdownPreview markdown={run.draft.markdown} />
                        </TabPanel>

                        <TabPanel px={0}>
                            <VStack align="stretch" spacing={4}>
                                <Card>
                                    <CardBody>
                                        <HStack spacing={6}>
                                            <Stat maxW="160px">
                                                <StatNumber color="green.500">{run.editorialReview.score}</StatNumber>
                                                <StatLabel>Editorial Score</StatLabel>
                                            </Stat>
                                            <Box>
                                                <Heading size="sm" mb={2}>Improvements</Heading>
                                                <BulletList items={run.editorialReview.improvements} />
                                            </Box>
                                        </HStack>
                                    </CardBody>
                                </Card>
                                <MarkdownPreview markdown={run.editorialReview.finalMarkdown} />
                            </VStack>
                        </TabPanel>

                        <TabPanel px={0}>
                            <Card>
                                <CardBody>
                                    <VStack align="stretch" spacing={3}>
                                        <HStack>
                                            <Icon as={FiFolder} />
                                            <Heading size="md">Saved Artifacts</Heading>
                                        </HStack>
                                        <Code p={3} whiteSpace="pre-wrap">{run.artifacts.directory}</Code>
                                        {Object.entries(run.artifacts.files).map(([label, filePath]) => (
                                            <Flex key={label} justify="space-between" gap={3} direction={{ base: 'column', md: 'row' }}>
                                                <HStack>
                                                    <Icon as={label.includes('draft') || label.includes('Story') ? FiEdit3 : FiFileText} />
                                                    <Text fontWeight="semibold">{label}</Text>
                                                </HStack>
                                                <Code whiteSpace="pre-wrap">{filePath}</Code>
                                            </Flex>
                                        ))}
                                    </VStack>
                                </CardBody>
                            </Card>
                        </TabPanel>
                    </TabPanels>
                </Tabs>
            )}

            {!run && !pipelineMutation.isPending && (
                <Card>
                    <CardBody>
                        <HStack color="gray.600">
                            <Icon as={FiTrendingUp} />
                            <Text>Run the pipeline to generate a researched Markdown story and local artifact bundle.</Text>
                        </HStack>
                    </CardBody>
                </Card>
            )}
        </VStack>
    );
};

export default TrendingTopics;
