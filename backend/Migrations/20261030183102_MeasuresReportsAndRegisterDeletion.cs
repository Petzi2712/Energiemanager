using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Energy.Api.Migrations
{
    /// <inheritdoc />
    public partial class MeasuresReportsAndRegisterDeletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DeletedAt",
                table: "Nodes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "MeasureImplemented",
                table: "Nodes",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "MeasureNotes",
                table: "Nodes",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Purpose",
                table: "Documents",
                type: "text",
                nullable: false,
                defaultValue: "General");

            migrationBuilder.CreateTable(
                name: "ReportDefinitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    SiteId = table.Column<Guid>(type: "uuid", nullable: true),
                    BuildingId = table.Column<Guid>(type: "uuid", nullable: true),
                    NodeId = table.Column<Guid>(type: "uuid", nullable: true),
                    Medium = table.Column<string>(type: "text", nullable: false),
                    From = table.Column<DateOnly>(type: "date", nullable: false),
                    To = table.Column<DateOnly>(type: "date", nullable: false),
                    IncludeTheory = table.Column<bool>(type: "boolean", nullable: false),
                    IncludeReadings = table.Column<bool>(type: "boolean", nullable: false),
                    IncludeMeasures = table.Column<bool>(type: "boolean", nullable: false),
                    Pdf = table.Column<bool>(type: "boolean", nullable: false),
                    Excel = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    DeletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReportDefinitions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReportDefinitions_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReportDefinitions_Nodes_CustomerId_BuildingId",
                        columns: x => new { x.CustomerId, x.BuildingId },
                        principalTable: "Nodes",
                        principalColumns: new[] { "CustomerId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReportDefinitions_Nodes_CustomerId_NodeId",
                        columns: x => new { x.CustomerId, x.NodeId },
                        principalTable: "Nodes",
                        principalColumns: new[] { "CustomerId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReportDefinitions_Nodes_CustomerId_SiteId",
                        columns: x => new { x.CustomerId, x.SiteId },
                        principalTable: "Nodes",
                        principalColumns: new[] { "CustomerId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ReportDefinitions_CustomerId_BuildingId",
                table: "ReportDefinitions",
                columns: new[] { "CustomerId", "BuildingId" });

            migrationBuilder.CreateIndex(
                name: "IX_ReportDefinitions_CustomerId_NodeId",
                table: "ReportDefinitions",
                columns: new[] { "CustomerId", "NodeId" });

            migrationBuilder.CreateIndex(
                name: "IX_ReportDefinitions_CustomerId_SiteId",
                table: "ReportDefinitions",
                columns: new[] { "CustomerId", "SiteId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ReportDefinitions");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Nodes");

            migrationBuilder.DropColumn(
                name: "MeasureImplemented",
                table: "Nodes");

            migrationBuilder.DropColumn(
                name: "MeasureNotes",
                table: "Nodes");

            migrationBuilder.DropColumn(
                name: "Purpose",
                table: "Documents");
        }
    }
}
