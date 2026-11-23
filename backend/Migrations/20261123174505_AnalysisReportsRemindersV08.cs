using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Energy.Api.Migrations
{
    /// <inheritdoc />
    public partial class AnalysisReportsRemindersV08 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "Readings",
                type: "text",
                nullable: false,
                defaultValue: "Unknown");

            migrationBuilder.CreateTable(
                name: "GeneratedReports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    DefinitionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Sequence = table.Column<int>(type: "integer", nullable: false),
                    ReleasedFrom = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: false),
                    RequiredSites = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    SnapshotJson = table.Column<string>(type: "text", nullable: false),
                    SnapshotHash = table.Column<string>(type: "text", nullable: false),
                    Pdf = table.Column<byte[]>(type: "bytea", nullable: true),
                    Excel = table.Column<byte[]>(type: "bytea", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GeneratedReports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GeneratedReports_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GeneratedReports_ReportDefinitions_DefinitionId",
                        column: x => x.DefinitionId,
                        principalTable: "ReportDefinitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "QualityReviews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReadingId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReadingVersion = table.Column<int>(type: "integer", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Note = table.Column<string>(type: "text", nullable: false),
                    At = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QualityReviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QualityReviews_Readings_ReadingId",
                        column: x => x.ReadingId,
                        principalTable: "Readings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_QualityReviews_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ReminderDispatches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Cycle = table.Column<string>(type: "text", nullable: false),
                    Stage = table.Column<int>(type: "integer", nullable: false),
                    SettingsVersion = table.Column<int>(type: "integer", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    DueAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LeaseUntil = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SentAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    MessageId = table.Column<string>(type: "text", nullable: false),
                    LastError = table.Column<string>(type: "text", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReminderDispatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReminderDispatches_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReminderDispatches_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ReminderSettings",
                columns: table => new
                {
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    TimeZone = table.Column<string>(type: "text", nullable: false),
                    Day = table.Column<int>(type: "integer", nullable: false),
                    Hour = table.Column<int>(type: "integer", nullable: false),
                    Minute = table.Column<int>(type: "integer", nullable: false),
                    FollowUpDays = table.Column<int>(type: "integer", nullable: false),
                    UserIds = table.Column<Guid[]>(type: "uuid[]", nullable: false),
                    NextDueAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReminderSettings", x => x.CustomerId);
                    table.ForeignKey(
                        name: "FK_ReminderSettings_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GeneratedReports_CustomerId",
                table: "GeneratedReports",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_GeneratedReports_DefinitionId_Sequence",
                table: "GeneratedReports",
                columns: new[] { "DefinitionId", "Sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GeneratedReports_ReleasedFrom",
                table: "GeneratedReports",
                column: "ReleasedFrom",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QualityReviews_ReadingId_ReadingVersion",
                table: "QualityReviews",
                columns: new[] { "ReadingId", "ReadingVersion" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QualityReviews_UserId",
                table: "QualityReviews",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ReminderDispatches_CustomerId_Cycle_Stage_UserId",
                table: "ReminderDispatches",
                columns: new[] { "CustomerId", "Cycle", "Stage", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ReminderDispatches_Status_DueAt",
                table: "ReminderDispatches",
                columns: new[] { "Status", "DueAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ReminderDispatches_UserId",
                table: "ReminderDispatches",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GeneratedReports");

            migrationBuilder.DropTable(
                name: "QualityReviews");

            migrationBuilder.DropTable(
                name: "ReminderDispatches");

            migrationBuilder.DropTable(
                name: "ReminderSettings");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "Readings");
        }
    }
}
