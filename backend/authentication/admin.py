from django.contrib import admin
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin
from django.contrib.auth.models import Group
from unfold.admin import ModelAdmin

from authentication.models import CustomGroup, User


class GroupAdmin(BaseGroupAdmin, ModelAdmin[CustomGroup]):
    pass


class UserAdmin(ModelAdmin[User]):
    list_display = (
        "email",
        "first_name",
        "last_name",
        "is_superuser",
        "is_staff",
        "is_active",
        "date_joined",
    )
    list_filter = (
        "is_superuser",
        "is_staff",
        "is_active",
        "date_joined",
    )
    list_editable = (
        "is_active",
        "is_staff",
    )
    search_fields = ("email", "first_name", "last_name")
    ordering = ("-date_joined", "email")


admin.site.unregister(Group)
admin.site.register(User, UserAdmin)
admin.site.register(CustomGroup, GroupAdmin)
