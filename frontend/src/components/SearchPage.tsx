import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  Input,
  InputGroup,
  InputRightElement,
  Link,
  SimpleGrid,
  Spinner,
  Text,
  useToast,
  VStack
} from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { searchReddit } from '../services/api';
import type { RedditPost } from '../types/api';

const SearchPage = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [query, setQuery] = useState('');
    const toast = useToast();

    const { data: posts, isLoading, error } = useQuery<RedditPost[]>({
        queryKey: ['search', query],
        queryFn: () => searchReddit(query),
        enabled: !!query,
    });

    const handleSearch = () => {
        if (!searchTerm.trim()) {
            toast({
                title: 'Enter a search term',
                status: 'warning',
                duration: 2000,
            });
            return;
        }
        setQuery(searchTerm);
    };

    const getSentimentColor = (sentiment?: RedditPost['sentiment']) => {
        if (!sentiment) return 'gray';
        switch (sentiment.label) {
            case 'positive':
                return 'green';
            case 'negative':
                return 'red';
            default:
                return 'yellow';
        }
    };

    return (
        <VStack gap={8}>
            <Heading>Reddit Sentiment Analysis</Heading>
            <Box w="full" maxW="600px">
                <InputGroup size="lg">
                    <Input
                        placeholder="example query format: sentiment in r/subreddit"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <InputRightElement width="4.5rem">
                        <Button
                            h="1.75rem"
                            size="sm"
                            onClick={handleSearch}
                            isLoading={isLoading}
                        >
                            Search
                        </Button>
                    </InputRightElement>
                </InputGroup>
            </Box>

            {error && (
                <Text color="red.500">
                    Error loading results. Please try again.
                </Text>
            )}

            {isLoading && <Spinner size="xl" />}

            {posts && (
                <SimpleGrid
                    columns={{ base: 1, md: 2, lg: 3 }}
                    spacing={6}
                    w="full"
                >
                    {posts.map((post) => (
                        <Card key={post.id}>
                            <CardBody>
                                <VStack align="start" spacing={3}>
                                    <Heading size="sm">{post.title}</Heading>
                                    <Text fontSize="sm">
                                        Posted by u/{post.author} in r/{post.subreddit}
                                    </Text>
                                    {post.sentiment && (
                                        <>
                                            <Badge
                                                colorScheme={getSentimentColor(post.sentiment)}
                                            >
                                                {post.sentiment.label.toUpperCase()} ({post.sentiment.score.toFixed(2)})
                                            </Badge>
                                            <Text fontSize="sm">
                                                {post.sentiment.analysis}
                                            </Text>
                                            <Text fontSize="xs">
                                                Emotions: {post.sentiment.emotions.join(', ')}
                                            </Text>
                                        </>
                                    )}
                                    <Link
                                        href={`https://reddit.com${post.permalink}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        isExternal
                                    >
                                        <Button size="sm" variant="outline">
                                            View on Reddit
                                        </Button>
                                    </Link>
                                </VStack>
                            </CardBody>
                        </Card>
                    ))}
                </SimpleGrid>
            )}
        </VStack>
    );
};

export default SearchPage;