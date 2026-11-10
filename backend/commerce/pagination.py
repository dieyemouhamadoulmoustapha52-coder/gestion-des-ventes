
"""Pagination DRF — page_size = 10, conforme à docs/API_CONTRACT.md."""

from rest_framework.pagination import PageNumberPagination


class PaginationParPage(PageNumberPagination):
    page_size = 10
    page_size_query_param = None
    max_page_size = 100
