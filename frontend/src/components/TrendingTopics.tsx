import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Container,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
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
  useToast,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { FiSearch, FiTrendingUp, FiClock, FiUsers, FiBookOpen, FiFileText } from 'react-icons/fi';
import axios from 'axios';
import { config } from '../config';

interface RedditPost {
  id: string;
  title: string;
  selftext?: string;
  author?: string;
  score: number;
  num_comments: number;
  created_utc?: number;
  permalink: string;
}

interface ReferenceMaterial {
  topicId: string;
  topic: string;
  sourcePosts: unknown[];
  keyInsights: string[];
  quotableComments: Array<{
    text: string;
    author: string;
    context: string;
    relevance: string;
  }>;
  commonPainPoints: string[];
  successStories: string[];
  controversialPoints: string[];
  expertOpinions: string[];
  statistics: Array<{
    metric: string;
    value: string;
    context: string;
  }>;
  narrativeElements: {
    hooks: string[];
    personalStories: string[];
    transformations: string[];
  };
}

interface TrendingReference {
  topic: string;
  source?: string;
  topicData: TrendingTopic;
  referenceSummary: {
    keyInsights: number;
    quotableComments: number;
    painPoints: number;
    successStories: number;
    postsAnalyzed: number;
  };
  referenceMaterial: ReferenceMaterial;
}

interface TrendingTopic {
  topic: string;
  category: string;
  engagementScore: number;
  viralPotential: number;
  mediumSuccessProbability: number;
  keyThemes: string[];
  storyAngles: string[];
  targetAudience: string;
  estimatedReadTime: number;
  hooks: string[];
  source?: string;
  relevantPosts?: RedditPost[];
}

interface TrendingAnalysis {
  subreddit?: string;
  timeframe: string;
  postsAnalyzed: number;
  posts?: RedditPost[];
  trendingTopics: TrendingTopic[];
  bestStoryOpportunity: {
    title: string;
    angle: string;
    whyItWillWork: string;
  };
  references?: TrendingReference[];
}

const categoryColors: Record<string, string> = {
  'Technology': 'blue',
  'Software development': 'purple',
  'AI-Artificial Intelligence': 'teal',
  'Life': 'green',
  'Self-improvement': 'yellow',
  'Work': 'orange',
  'Society': 'red',
  'Culture': 'pink',
  'World': 'cyan',
  'Finance': 'gray'
};

const API_URL = config.apiUrl;

const TrendingTopics = () => {
  const [subreddit, setSubreddit] = useState('');
  const [timeframe, setTimeframe] = useState('week');
  const [autoGatherReferences, setAutoGatherReferences] = useState(false);
  const [topicsToGather, setTopicsToGather] = useState(3);
  const [postsLimit, setPostsLimit] = useState(50);
  const [activeTab, setActiveTab] = useState(0);
  const toast = useToast();

  // Query for single subreddit
  const {
    data: singleAnalysis,
    isLoading: isLoadingSingle,
    refetch: refetchSingle,
    isRefetching: isRefetchingSingle
  } = useQuery<TrendingAnalysis>({
    queryKey: ['trending', subreddit, timeframe, autoGatherReferences, topicsToGather, postsLimit],
    queryFn: async () => {
      const params = new URLSearchParams({
        timeframe,
        limit: postsLimit.toString(),
        ...(autoGatherReferences && {
          gatherReferences: 'true',
          topicsToGather: topicsToGather.toString()
        })
      });
      const response = await axios.get(`${API_URL}/trending/${subreddit}?${params}`);
      return response.data;
    },
    enabled: false
  });

  // Query for multi-subreddit
  const {
    data: multiAnalysis,
    isLoading: isLoadingMulti,
    refetch: refetchMulti,
    isRefetching: isRefetchingMulti
  } = useQuery<TrendingAnalysis>({
    queryKey: ['trending-multi', timeframe, autoGatherReferences, postsLimit],
    queryFn: async () => {
      const subreddits = 'technology,programming,artificial,machinelearning,webdev';
      const params = new URLSearchParams({
        subreddits,
        timeframe,
        limit: postsLimit.toString(), // Divide limit by number of subreddits
        ...(autoGatherReferences && {
          gatherReferences: 'true',
          topicsToGather: '2'
        })
      });
      const response = await axios.get(`${API_URL}/trending/multi?${params}`);
      return response.data;
    },
    enabled: false
  });

  // Mutation for gathering references
  const gatherReferencesMutation = useMutation({
    mutationFn: async ({ topic, subreddit }: { topic: TrendingTopic; subreddit: string }) => {
      // Get post IDs from topic's relevant posts
      let postIds = topic.relevantPosts?.map(post => post.id) || [];

      // Fallback if no relevant posts are attached to the topic
      if (postIds.length === 0 && currentAnalysis?.posts) {
        console.warn(`No relevant posts for topic "${topic.topic}", using top posts as fallback`);
        postIds = currentAnalysis.posts.slice(0, 5).map(post => post.id);
      }

      if (postIds.length === 0) {
        throw new Error('No posts available for reference gathering');
      }

      const response = await axios.post(`${API_URL}/trending/${subreddit}/references`, {
        topic: topic.topic,
        postIds
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'References gathered successfully',
        description: `Found ${data.summary.keyInsights} insights and ${data.summary.quotableComments} quotes`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    },
    onError: () => {
      toast({
        title: 'Failed to gather references',
        description: 'Please try again later',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  });

  const handleSingleSearch = () => {
    if (!subreddit) {
      toast({
        title: 'Please enter a subreddit name',
        status: 'warning',
        duration: 3000,
      });
      return;
    }
    refetchSingle();
  };

  const handleMultiSearch = () => {
    setActiveTab(1);
    refetchMulti();
  };

  const isLoading = isLoadingSingle || isRefetchingSingle || isLoadingMulti || isRefetchingMulti;
  const currentAnalysis = activeTab === 0 ? singleAnalysis : multiAnalysis;

  return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8} align="stretch">
          <Box textAlign="center">
            <Heading size="2xl" mb={2}>Reddit → Medium Story Finder</Heading>
            <Text color="gray.600">Discover trending Reddit topics worth writing about on Medium</Text>
          </Box>

          <Card>
            <CardBody>
              <VStack spacing={4}>
                <HStack spacing={4} w="full">
                  <InputGroup flex={1}>
                    <InputLeftElement pointerEvents="none">
                      <Icon as={FiSearch} color="gray.400" />
                    </InputLeftElement>
                    <Input
                        placeholder="Enter subreddit name (e.g., technology)"
                        value={subreddit}
                        onChange={(e) => setSubreddit(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSingleSearch()}
                    />
                  </InputGroup>
                  <Select
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value)}
                      w="150px"
                  >
                    <option value="day">Past Day</option>
                    <option value="week">Past Week</option>
                    <option value="month">Past Month</option>
                  </Select>
                  <HStack>
                    <Text fontSize="sm" color="gray.600" whiteSpace="nowrap">Posts:</Text>
                    <NumberInput
                        size="md"
                        min={10}
                        max={100}
                        value={postsLimit}
                        onChange={(_, value) => setPostsLimit(value)}
                        w="80px"
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </HStack>
                  <Button
                      colorScheme="blue"
                      onClick={handleSingleSearch}
                      isLoading={isLoadingSingle || isRefetchingSingle}
                      leftIcon={<Icon as={FiSearch} />}
                  >
                    Analyze
                  </Button>
                </HStack>

                <Flex justify="space-between" align="center" w="full">
                  <HStack spacing={4}>
                    <Checkbox
                        isChecked={autoGatherReferences}
                        onChange={(e) => setAutoGatherReferences(e.target.checked)}
                    >
                      Auto-gather references
                    </Checkbox>
                    {autoGatherReferences && (
                        <HStack>
                          <Text fontSize="sm" color="gray.600">Top</Text>
                          <NumberInput
                              size="sm"
                              min={1}
                              max={5}
                              value={topicsToGather}
                              onChange={(_, value) => setTopicsToGather(value)}
                              w="60px"
                          >
                            <NumberInputField />
                            <NumberInputStepper>
                              <NumberIncrementStepper />
                              <NumberDecrementStepper />
                            </NumberInputStepper>
                          </NumberInput>
                          <Text fontSize="sm" color="gray.600">topics</Text>
                        </HStack>
                    )}
                  </HStack>

                  <Button
                      size="sm"
                      colorScheme="purple"
                      onClick={handleMultiSearch}
                      isLoading={isLoadingMulti || isRefetchingMulti}
                  >
                    Analyze Tech Bundle
                  </Button>
                </Flex>
              </VStack>
            </CardBody>
          </Card>

          {isLoading && (
              <Box textAlign="center" py={8}>
                <Spinner size="xl" color="blue.500" thickness="4px" />
                <Text mt={4} color="gray.600">Analyzing Reddit posts...</Text>
              </Box>
          )}

          {currentAnalysis && !isLoading && (
              <Tabs index={activeTab} onChange={setActiveTab}>
                <TabList>
                  <Tab>Single Subreddit</Tab>
                  <Tab>Multi-Subreddit</Tab>
                </TabList>

                <TabPanels>
                  <TabPanel px={0}>
                    <VStack spacing={6} align="stretch">
                      {currentAnalysis.bestStoryOpportunity && (
                          <Card
                              bg="purple.500"
                              color="white"
                              bgGradient="linear(to-r, purple.500, pink.500)"
                          >
                            <CardHeader>
                              <Heading size="md" display="flex" alignItems="center" gap={2}>
                                <Icon as={FiTrendingUp} />
                                Best Story Opportunity
                              </Heading>
                            </CardHeader>
                            <CardBody>
                              <VStack align="start" spacing={2}>
                                <Heading size="sm">{currentAnalysis.bestStoryOpportunity.title}</Heading>
                                <Text><strong>Angle:</strong> {currentAnalysis.bestStoryOpportunity.angle}</Text>
                                <Text><strong>Why it will work:</strong> {currentAnalysis.bestStoryOpportunity.whyItWillWork}</Text>
                              </VStack>
                            </CardBody>
                          </Card>
                      )}

                      <Card>
                        <CardBody>
                          <SimpleGrid columns={3} spacing={4}>
                            <Stat textAlign="center">
                              <StatNumber color="blue.500">{currentAnalysis.postsAnalyzed}</StatNumber>
                              <StatLabel>Posts Analyzed</StatLabel>
                            </Stat>
                            <Stat textAlign="center">
                              <StatNumber color="green.500">{currentAnalysis.trendingTopics.length}</StatNumber>
                              <StatLabel>Trending Topics</StatLabel>
                            </Stat>
                            <Stat textAlign="center">
                              <StatNumber color="purple.500">{currentAnalysis.timeframe}</StatNumber>
                              <StatLabel>Timeframe</StatLabel>
                            </Stat>
                          </SimpleGrid>
                        </CardBody>
                      </Card>

                      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                        {currentAnalysis.trendingTopics.map((topic , index) => (
                            <Card key={index} transition="all 0.2s" _hover={{ shadow: 'lg' }}>
                              <CardBody>
                                <VStack align="stretch" spacing={3}>
                                  <Flex justify="space-between" align="start">
                                    <Heading size="sm" flex={1}>{topic.topic}</Heading>
                                    <Badge colorScheme={categoryColors[topic.category] || 'gray'}>
                                      {topic.category}
                                    </Badge>
                                  </Flex>

                                  {topic.source && (
                                      <Text fontSize="sm" color="gray.500">from r/{topic.source}</Text>
                                  )}

                                  <Box>
                                    <Flex justify="space-between" fontSize="sm" mb={1}>
                                      <Text color="gray.600">Medium Success</Text>
                                      <Text fontWeight="bold">{topic.mediumSuccessProbability}%</Text>
                                    </Flex>
                                    <Progress value={topic.mediumSuccessProbability} colorScheme="green" size="sm" />
                                  </Box>

                                  <HStack fontSize="sm" color="gray.600" spacing={4}>
                                    <HStack>
                                      <Icon as={FiClock} />
                                      <Text>{topic.estimatedReadTime} min</Text>
                                    </HStack>
                                    <HStack>
                                      <Icon as={FiUsers} />
                                      <Text>{topic.targetAudience}</Text>
                                    </HStack>
                                  </HStack>

                                  <Box>
                                    <Text fontSize="sm" fontWeight="semibold" mb={1}>Story Angles:</Text>
                                    <VStack align="start" spacing={1}>
                                      {topic.storyAngles.slice(0, 2).map((angle, i) => (
                                          <Text key={i} fontSize="sm" color="gray.600">
                                            • {angle}
                                          </Text>
                                      ))}
                                    </VStack>
                                  </Box>

                                  <Box>
                                    <Text fontSize="sm" fontWeight="semibold" mb={1}>Key Themes:</Text>
                                    <Wrap>
                                      {topic.keyThemes.map((theme, i) => (
                                          <WrapItem key={i}>
                                            <Badge variant="subtle" colorScheme="gray">
                                              {theme}
                                            </Badge>
                                          </WrapItem>
                                      ))}
                                    </Wrap>
                                  </Box>

                                  <HStack fontSize="sm" spacing={4}>
                                    <HStack>
                                      <Icon as={FiTrendingUp} />
                                      <Text>Viral: {topic.viralPotential}%</Text>
                                    </HStack>
                                    <HStack>
                                      <Icon as={FiBookOpen} />
                                      <Text>Engagement: {topic.engagementScore}</Text>
                                    </HStack>
                                  </HStack>

                                  <Button
                                      size="sm"
                                      colorScheme="purple"
                                      leftIcon={<Icon as={FiFileText} />}
                                      onClick={() => gatherReferencesMutation.mutate({
                                        topic,
                                        subreddit: currentAnalysis.subreddit || subreddit
                                      })}
                                      isLoading={gatherReferencesMutation.isPending}
                                      isDisabled={autoGatherReferences}
                                      w="full"
                                  >
                                    {autoGatherReferences ? 'References Auto-gathered' : 'Gather References'}
                                  </Button>
                                </VStack>
                              </CardBody>
                            </Card>
                        ))}
                      </SimpleGrid>
                    </VStack>
                  </TabPanel>

                  <TabPanel px={0}>
                    {/* Same content structure for multi-subreddit results */}
                    <Text>Multi-subreddit analysis results will appear here</Text>
                  </TabPanel>
                </TabPanels>
              </Tabs>
          )}
        </VStack>
      </Container>
  );
};

export default TrendingTopics;