from django.contrib import admin

from .models import SectionFeedback, FeedbackReply, FeedbackAttachment


class FeedbackReplyInline(admin.TabularInline):
    model = FeedbackReply
    extra = 0
    readonly_fields = ('author', 'created_at')


class FeedbackAttachmentInline(admin.TabularInline):
    model = FeedbackAttachment
    fk_name = 'feedback'
    extra = 0
    readonly_fields = ('created_at',)


@admin.register(SectionFeedback)
class SectionFeedbackAdmin(admin.ModelAdmin):
    list_display = ('id', 'section', 'author', 'text_preview', 'status', 'created_at')
    list_filter = ('section', 'status', 'created_at')
    search_fields = ('text', 'author__username', 'author__first_name', 'author__last_name')
    list_editable = ('status',)
    readonly_fields = ('author', 'created_at', 'updated_at')
    inlines = [FeedbackAttachmentInline, FeedbackReplyInline]

    def text_preview(self, obj):
        return obj.text[:100] + '...' if len(obj.text) > 100 else obj.text
    text_preview.short_description = 'Текст'


@admin.register(FeedbackReply)
class FeedbackReplyAdmin(admin.ModelAdmin):
    list_display = ('id', 'feedback', 'author', 'text_preview', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('text', 'author__username')
    readonly_fields = ('author', 'feedback', 'created_at')

    def text_preview(self, obj):
        return obj.text[:100] + '...' if len(obj.text) > 100 else obj.text
    text_preview.short_description = 'Текст'
