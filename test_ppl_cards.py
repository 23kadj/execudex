#!/usr/bin/env python3
"""
test_ppl_cards.py - Test script for PoliticalCardGenerator

This script tests the core functionality of the PoliticalCardGenerator class
without making actual API calls or database modifications.
"""

import os
import sys
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock

# Add the current directory to Python path to import ppl_cards
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the class we want to test
from ppl_cards import PoliticalCardGenerator


def test_initialization():
    """Test that the PoliticalCardGenerator initializes correctly."""
    print("🧪 Testing initialization...")
    
    # Mock environment variables
    with patch.dict(os.environ, {
        'SUPABASE_URL': 'https://test.supabase.co',
        'SUPABASE_SERVICE_ROLE_KEY': 'test-key',
        'TAVILY_API_KEY': 'test-tavily-key',
        'MISTRAL_API_KEY': 'test-mistral-key'
    }):
        try:
            generator = PoliticalCardGenerator()
            print("✅ Initialization successful")
            return True
        except Exception as e:
            print(f"❌ Initialization failed: {e}")
            return False


def test_tier_quotas():
    """Test that tier quotas are correctly defined."""
    print("🧪 Testing tier quotas...")
    
    with patch.dict(os.environ, {
        'SUPABASE_URL': 'https://test.supabase.co',
        'SUPABASE_SERVICE_ROLE_KEY': 'test-key',
        'TAVILY_API_KEY': 'test-tavily-key',
        'MISTRAL_API_KEY': 'test-mistral-key'
    }):
        generator = PoliticalCardGenerator()
        
        # Test hard tier
        assert 'hard' in generator.tier_quotas
        assert len(generator.tier_quotas['hard']['categories']) == 18
        assert generator.tier_quotas['hard']['target_per_category'] == 10
        
        # Test soft tier
        assert 'soft' in generator.tier_quotas
        assert len(generator.tier_quotas['soft']['categories']) == 12
        assert generator.tier_quotas['soft']['target_per_category'] == 6
        
        # Test base tier
        assert 'base' in generator.tier_quotas
        assert len(generator.tier_quotas['base']['screens']) == 3
        assert generator.tier_quotas['base']['target_per_screen'] == 10
        
        print("✅ Tier quotas correctly defined")
        return True


def test_special_queries():
    """Test that special query mappings are correctly defined."""
    print("🧪 Testing special queries...")
    
    with patch.dict(os.environ, {
        'SUPABASE_URL': 'https://test.supabase.co',
        'SUPABASE_SERVICE_ROLE_KEY': 'test-key',
        'TAVILY_API_KEY': 'test-tavily-key',
        'MISTRAL_API_KEY': 'test-mistral-key'
    }):
        generator = PoliticalCardGenerator()
        
        # Test special queries exist
        expected_special = ['party', 'enterprises', 'businesses', 'politicians', 'medias', 'organizations']
        for query in expected_special:
            assert query in generator.special_queries
        
        # Test base screen queries
        expected_screens = ['agenda_ppl', 'affiliates', 'identity']
        for screen in expected_screens:
            assert screen in generator.base_screen_queries
        
        print("✅ Special queries correctly defined")
        return True


def test_build_search_queries():
    """Test search query building logic."""
    print("🧪 Testing search query building...")
    
    with patch.dict(os.environ, {
        'SUPABASE_URL': 'https://test.supabase.co',
        'SUPABASE_SERVICE_ROLE_KEY': 'test-key',
        'TAVILY_API_KEY': 'test-tavily-key',
        'MISTRAL_API_KEY': 'test-mistral-key'
    }):
        generator = PoliticalCardGenerator()
        
        # Test hard tier category queries
        query = generator.build_search_queries("John Doe", "hard", "economy")
        assert query == "John Doe economy"
        
        # Test special query mapping
        query = generator.build_search_queries("John Doe", "hard", "party")
        assert query == "John Doe party affiliation"
        
        # Test base tier screen queries
        query = generator.build_search_queries("John Doe", "base", "identity")
        assert query == "John Doe who is"
        
        print("✅ Search query building works correctly")
        return True


def test_choose_mistral_model():
    """Test Mistral model selection logic."""
    print("🧪 Testing Mistral model selection...")
    
    with patch.dict(os.environ, {
        'SUPABASE_URL': 'https://test.supabase.co',
        'SUPABASE_SERVICE_ROLE_KEY': 'test-key',
        'TAVILY_API_KEY': 'test-tavily-key',
        'MISTRAL_API_KEY': 'test-mistral-key'
    }):
        generator = PoliticalCardGenerator()
        
        # Test small content (use medium)
        model = generator.choose_mistral_model(50000)
        assert model == "mistral-small-latest"
        
        # Test medium content (use large)
        model = generator.choose_mistral_model(200000)
        assert model == "mistral-large-latest"
        
        # Test large content (skip)
        model = generator.choose_mistral_model(500000)
        assert model is None
        
        print("✅ Mistral model selection works correctly")
        return True


def test_text_cleaning():
    """Test text cleaning functionality."""
    print("🧪 Testing text cleaning...")
    
    with patch.dict(os.environ, {
        'SUPABASE_URL': 'https://test.supabase.co',
        'SUPABASE_SERVICE_ROLE_KEY': 'test-key',
        'TAVILY_API_KEY': 'test-tavily-key',
        'MISTRAL_API_KEY': 'test-mistral-key'
    }):
        generator = PoliticalCardGenerator()
        
        # Test HTML tag removal
        dirty_text = "<p>This is <b>bold</b> text with <script>alert('test')</script> HTML</p>"
        clean_text = generator.clean_text(dirty_text)
        assert "<p>" not in clean_text
        assert "<b>" not in clean_text
        assert "<script>" not in clean_text
        assert "This is bold text with HTML" in clean_text
        
        # Test whitespace normalization
        dirty_text = "Multiple    spaces\n\nand\n\n\nnewlines"
        clean_text = generator.clean_text(dirty_text)
        assert "  " not in clean_text  # No double spaces
        assert "\n" not in clean_text  # No newlines
        
        print("✅ Text cleaning works correctly")
        return True


def test_deficit_calculation():
    """Test deficit calculation logic."""
    print("🧪 Testing deficit calculation...")
    
    with patch.dict(os.environ, {
        'SUPABASE_URL': 'https://test.supabase.co',
        'SUPABASE_SERVICE_ROLE_KEY': 'test-key',
        'TAVILY_API_KEY': 'test-tavily-key',
        'MISTRAL_API_KEY': 'test-mistral-key'
    }):
        generator = PoliticalCardGenerator()
        
        # Test hard tier deficits
        current_counts = {'economy': 3, 'immigration': 10, 'healthcare': 0}
        deficits = generator.calculate_deficits('hard', current_counts)
        
        assert deficits['economy'] == 7  # 10 - 3 = 7
        assert 'immigration' not in deficits  # Already at target
        assert deficits['healthcare'] == 10  # 10 - 0 = 10
        
        # Test soft tier deficits
        current_counts = {'economy': 2, 'social programs': 6}
        deficits = generator.calculate_deficits('soft', current_counts)
        
        assert deficits['economy'] == 4  # 6 - 2 = 4
        assert 'social programs' not in deficits  # Already at target
        
        print("✅ Deficit calculation works correctly")
        return True


def test_deduplication():
    """Test card deduplication logic."""
    print("🧪 Testing deduplication...")
    
    with patch.dict(os.environ, {
        'SUPABASE_URL': 'https://test.supabase.co',
        'SUPABASE_SERVICE_ROLE_KEY': 'test-key',
        'TAVILY_API_KEY': 'test-tavily-key',
        'MISTRAL_API_KEY': 'test-mistral-key'
    }):
        generator = PoliticalCardGenerator()
        
        # Mock existing cards (recent)
        now = datetime.utcnow()
        existing_cards = [
            {
                'title': 'Existing Card 1',
                'created_at': now.isoformat() + 'Z'
            },
            {
                'title': 'Existing Card 2',
                'created_at': (now - timedelta(days=3)).isoformat() + 'Z'
            }
        ]
        
        # Mock new cards
        new_cards = [
            {'title': 'New Card 1'},
            {'title': 'Existing Card 1'},  # Duplicate of existing
            {'title': 'New Card 2'},
            {'title': 'New Card 1'}  # Duplicate within new
        ]
        
        # Test deduplication
        unique_cards = generator.deduplicate_cards(new_cards, existing_cards)
        
        # Should have 2 unique cards (New Card 1 and New Card 2)
        assert len(unique_cards) == 2
        assert unique_cards[0]['title'] == 'New Card 1'
        assert unique_cards[1]['title'] == 'New Card 2'
        
        print("✅ Deduplication works correctly")
        return True


def run_all_tests():
    """Run all test functions."""
    print("🚀 Starting PoliticalCardGenerator tests...\n")
    
    tests = [
        test_initialization,
        test_tier_quotas,
        test_special_queries,
        test_build_search_queries,
        test_choose_mistral_model,
        test_text_cleaning,
        test_deficit_calculation,
        test_deduplication
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
            print()
        except Exception as e:
            print(f"❌ Test {test.__name__} failed with exception: {e}\n")
    
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The PoliticalCardGenerator is working correctly.")
        return True
    else:
        print("⚠️ Some tests failed. Please check the implementation.")
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)

