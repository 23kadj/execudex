# Political Profile Card Generator (ppl_cards.py)

## Overview

The `ppl_cards.py` script automatically generates political profile cards for politicians using AI-powered content analysis. It integrates with Tavily search, Mistral AI, and Supabase to create comprehensive, up-to-date political profiles.

## Features

- **Tier-based quotas**: Automatically manages card counts based on politician influence tiers (hard, soft, base)
- **Freshness management**: Automatically removes cards older than 7 days
- **AI-powered content**: Uses Mistral AI to analyze web content and generate structured card data
- **Smart deduplication**: Prevents duplicate cards and maintains content quality
- **Category organization**: Organizes cards by policy areas and screens

## Prerequisites

### 1. Python Environment
- Python 3.8 or higher
- pip package manager

### 2. API Keys Required
- **Supabase**: Database URL and service role key
- **Tavily**: Search API key
- **Mistral**: AI API key

### 3. Database Setup
- Supabase project with `ppl_index` and `card_index` tables
- Proper table schemas and permissions

## Installation

### 1. Clone/Download the Project
```bash
# If using git
git clone <repository-url>
cd execudex

# Or download and extract the project files
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Environment Configuration
Create a `.env` file in the project root with your API keys:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Tavily Search API
TAVILY_API_KEY=your-tavily-api-key

# Mistral AI API
MISTRAL_API_KEY=your-mistral-api-key
```

**Important**: Never commit your `.env` file to version control!

## Usage

### Basic Usage
```bash
python ppl_cards.py <politician_id>
```

### Examples
```bash
# Generate cards for politician with ID 123
python ppl_cards.py 123

# Generate cards for politician with ID 456
python ppl_cards.py 456
```

### Command Line Arguments
- `politician_id`: Integer ID of the politician from the `ppl_index` table

## How It Works

### 1. Profile Loading
- Fetches politician profile from `ppl_index` table
- Determines tier (hard, soft, base) and name

### 2. Existing Card Analysis
- Retrieves all existing cards for the politician
- Removes cards older than 7 days (freshness rule)
- Counts current cards by category/screen

### 3. Deficit Calculation
- Compares current counts against tier-based quotas
- Determines how many new cards are needed for each bucket

### 4. Content Generation
- Uses Tavily to search for relevant content
- Extracts and cleans web pages
- Uses Mistral AI to generate structured card data

### 5. Quality Control
- Validates all required fields
- Removes duplicate content
- Ensures proper categorization

### 6. Database Insertion
- Assigns unique IDs to new cards
- Inserts validated cards into `card_index` table

## Tier-Based Quotas

### Hard Tier (High Influence)
- **Categories**: 18 policy areas (economy, immigration, healthcare, etc.)
- **Target**: 10 cards per category
- **Total**: Up to 180 cards

### Soft Tier (Moderate Influence)
- **Categories**: 12 policy areas
- **Target**: 6 cards per category
- **Total**: Up to 72 cards

### Base Tier (Low Influence)
- **Screens**: 3 main areas (agenda_ppl, identity, affiliates)
- **Target**: 10 cards per screen
- **Total**: Up to 30 cards

## Card Structure

Each generated card includes:

```json
{
  "id": "unique_integer_id",
  "title": "5-10 word specific focus",
  "subtext": "15-20 word expansion",
  "screen": "agenda_ppl|identity|affiliates",
  "created_at": "UTC timestamp",
  "owner_id": "politician_id_integer",
  "is_ppl": true,
  "is_media": "boolean_source_type",
  "category": "policy_category_for_hard_soft_tiers",
  "score": "0-100_importance_rating",
  "web_content": "full_cleaned_text",
  "link": "source_url"
}
```

## Special Query Mappings

Certain categories use specialized search queries:

- `party` → "Politician Name party affiliation"
- `enterprises` → "which companies are supporting Politician Name"
- `businesses` → "which companies are supporting Politician Name"
- `politicians` → "which politicians support Politician Name"
- `medias` → "which media outlets support Politician Name"
- `organizations` → "which organizations are supporting Politician Name"

## Content Processing

### Text Extraction
- Full page content extraction using requests + html2text
- Automatic HTML to plain text conversion
- Content length validation (max 445,000 characters)

### Text Cleaning
- Removes HTML tags, scripts, and styles
- Eliminates boilerplate and navigation elements
- Normalizes whitespace and formatting

### AI Analysis
- **Mistral Medium**: For content ≤110,000 characters
- **Mistral Large**: For content 110,000-445,000 characters
- **Skip**: For content >445,000 characters

## Error Handling

The script includes comprehensive error handling for:
- API failures (Tavily, Mistral, Supabase)
- Network timeouts and connection issues
- Invalid or malformed content
- Database constraint violations
- Missing or invalid API keys

## Logging and Output

The script provides detailed console output:
- 🚀 Process start and progress
- 📋 Profile information
- 📊 Card counts and deficits
- 🔍 Search queries and results
- 📄 Content processing status
- ✅ Success confirmations
- ❌ Error details
- ⚠️ Warnings and skipped content

## Performance Considerations

### Rate Limiting
- Respects API rate limits for Tavily and Mistral
- Implements appropriate delays between requests

### Content Size
- Automatically skips overly large pages
- Uses appropriate AI models based on content length

### Database Efficiency
- Batch inserts for multiple cards
- Efficient queries with proper indexing

## Troubleshooting

### Common Issues

1. **Missing API Keys**
   ```
   ❌ Missing Supabase environment variables
   ❌ Missing Tavily API key
   ❌ Missing Mistral API key
   ```
   **Solution**: Check your `.env` file and ensure all keys are set

2. **Database Connection Errors**
   ```
   ❌ Error fetching politician profile
   ❌ Error inserting cards
   ```
   **Solution**: Verify Supabase URL and service role key

3. **Content Extraction Failures**
   ```
   ❌ Error extracting content from URL
   ❌ Content too long - skipping
   ```
   **Solution**: Check network connectivity and URL accessibility

4. **AI Generation Failures**
   ```
   ❌ Error parsing AI response as JSON
   ❌ Missing required fields in AI response
   ```
   **Solution**: Verify Mistral API key and check API quotas

### Debug Mode
For detailed debugging, you can modify the script to include additional logging:

```python
# Add to the top of the script
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Security Considerations

- **API Keys**: Never expose API keys in code or logs
- **Database Access**: Use service role key only for server-side operations
- **Content Validation**: All external content is sanitized before processing
- **Rate Limiting**: Respect API usage limits to avoid abuse

## Monitoring and Maintenance

### Regular Tasks
- Monitor API usage and quotas
- Check database performance and storage
- Review generated content quality
- Update tier assignments as needed

### Performance Metrics
- Cards generated per politician
- Content processing success rate
- API response times
- Database insertion performance

## Support and Updates

For issues, questions, or feature requests:
1. Check this README for common solutions
2. Review the console output for error details
3. Verify all dependencies and API keys
4. Check API service status pages

## License

This script is part of the Execudex project. Please refer to the project's main license for usage terms.
